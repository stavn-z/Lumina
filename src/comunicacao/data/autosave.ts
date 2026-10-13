// Controlador de salvamento automático, independente de React (testável à parte).
// - change(v): guarda o valor mais recente e agenda o salvamento (atraso de ~800 ms).
// - Um salvamento por vez; se o usuário digitar durante o envio, salva de novo ao final.
// - Em erro: o valor continua guardado (nada se perde) e retry() tenta de novo.
//   Continuar digitando também agenda uma nova tentativa.
// - Em conflito (outra pessoa salvou antes): para de salvar até resolveConflict().

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
export type SaveOutcome = 'ok' | 'conflict';

export class AutosaveController<T> {
  status: SaveStatus = 'idle';
  error = '';
  private value: T | undefined;
  private hasValue = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight: Promise<void> | null = null;
  private save: (v: T) => Promise<SaveOutcome>;
  private onStatus: (s: SaveStatus, error: string) => void;
  private delay: number;

  constructor(save: (v: T) => Promise<SaveOutcome>, onStatus: (s: SaveStatus, error: string) => void, delay = 800) {
    this.save = save;
    this.onStatus = onStatus;
    this.delay = delay;
  }

  setSave(save: (v: T) => Promise<SaveOutcome>) { this.save = save; }

  /** Há algo ainda não confirmado pelo servidor. */
  get dirty() { return this.hasValue || !!this.inFlight; }

  /** O valor que ainda não foi salvo (por exemplo, para mostrar num conflito). */
  get pendingValue() { return this.hasValue ? this.value : undefined; }

  change(v: T) {
    this.value = v;
    this.hasValue = true;
    if (this.status === 'conflict') return;
    this.set('saving');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.run(); }, this.delay);
  }

  /** Salva já o que estiver pendente (fechar a área, trocar de template). */
  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.status === 'conflict') return Promise.resolve();
    return this.run();
  }

  retry(): Promise<void> {
    if (this.status !== 'error') return Promise.resolve();
    this.set('saving');
    return this.flush();
  }

  /** Depois que o usuário decidiu o conflito (carregar a versão do outro, manter a sua etc.). */
  resolveConflict(keepPending: boolean) {
    if (!keepPending) { this.hasValue = false; this.value = undefined; }
    this.set(this.hasValue ? 'saving' : 'saved');
    if (this.hasValue) void this.flush();
  }

  /** Descarta o que não foi salvo (ex.: o template foi excluído). */
  discard() {
    clearTimeout(this.timer);
    this.hasValue = false;
    this.value = undefined;
    this.set('idle');
  }

  dispose() { clearTimeout(this.timer); }

  private async run(): Promise<void> {
    if (this.inFlight) {
      while (this.inFlight) await this.inFlight;
      return this.hasValue && this.status === 'saving' ? this.run() : undefined;
    }
    if (!this.hasValue) return;
    const v = this.value as T;
    this.hasValue = false;
    this.inFlight = (async () => {
      try {
        const outcome = await this.save(v);
        if (outcome === 'conflict') {
          if (!this.hasValue) { this.value = v; this.hasValue = true; }
          this.set('conflict');
        } else if (!this.hasValue) {
          this.set('saved');
        }
      } catch (e: any) {
        if (!this.hasValue) { this.value = v; this.hasValue = true; }
        this.error = e?.message || String(e);
        this.set('error');
      }
    })();
    await this.inFlight;
    this.inFlight = null;
    // Digitou durante o envio: salva a versão mais nova (exceto se parou por erro/conflito).
    if (this.hasValue && this.status === 'saving') {
      clearTimeout(this.timer);
      return this.run();
    }
  }

  private set(s: SaveStatus) {
    if (s !== 'error') this.error = '';
    this.status = s;
    this.onStatus(s, this.error);
  }
}
