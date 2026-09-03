// view/hud.ts — neon teşhis HUD'u. vy grafiği overlay canvas'ına glow'lu
// çizilir (shadowBlur); sayısal durum + kutu enerji metresi DOM'da güncellenir.
// Sadece SUNUM; ölçülen değerler CharacterMover'dan geliyor, dokunulmadı.

export interface HudElements {
  overlay: HTMLCanvasElement;
  vy: HTMLElement;
  state: HTMLElement;
  energyFill: HTMLElement;
}

export interface HudFrame {
  vy: number;
  grounded: boolean;
  inCoyote: boolean;
  boxEnergy: number;
}

const CYAN = "#22d3ee";
const VIOLET = "#a78bfa";
const SUCCESS = "#34d399";
const WARNING = "#fbbf24";

export class Hud {
  private ctx: CanvasRenderingContext2D;
  private history: number[] = [];
  private readonly cap = 200;

  constructor(private readonly el: HudElements) {
    this.ctx = el.overlay.getContext("2d")!;
  }

  pushVy(v: number): void {
    this.history.push(v);
    if (this.history.length > this.cap) this.history.shift();
  }

  render(f: HudFrame): void {
    this.drawGraph();
    this.updateStats(f);
  }

  private drawGraph(): void {
    const { ctx } = this;
    const w = this.el.overlay.width;
    const h = this.el.overlay.height;
    const mid = h * 0.5;
    ctx.clearRect(0, 0, w, h);

    // Sıfır çizgisi.
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();

    if (this.history.length < 2) return;

    const scaleY = (vy: number): number => mid - (vy / 12) * (mid - 8);
    const px = (i: number): number => (i / (this.cap - 1)) * w;
    const start = this.cap - this.history.length;

    // Eğri altı neon dolgu.
    ctx.beginPath();
    ctx.moveTo(px(start), mid);
    this.history.forEach((vy, i) => ctx.lineTo(px(start + i), scaleY(vy)));
    ctx.lineTo(px(start + this.history.length - 1), mid);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(34,211,238,0.28)");
    grad.addColorStop(1, "rgba(34,211,238,0.0)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Neon çizgi + glow.
    ctx.save();
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    this.history.forEach((vy, i) => {
      const x = px(start + i);
      const y = scaleY(vy);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Baş nokta parlayan uç.
    const last = this.history[this.history.length - 1];
    const hx = px(this.cap - 1);
    const hy = scaleY(last);
    ctx.shadowBlur = 18;
    ctx.fillStyle = last >= 0 ? SUCCESS : CYAN;
    ctx.beginPath();
    ctx.arc(hx, hy, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private updateStats(f: HudFrame): void {
    this.el.vy.textContent = f.vy.toFixed(1);

    let label: string;
    let color: string;
    if (f.grounded) {
      label = "GROUNDED";
      color = SUCCESS;
    } else if (f.inCoyote) {
      label = "COYOTE";
      color = WARNING;
    } else {
      label = "AIRBORNE";
      color = VIOLET;
    }
    this.el.state.textContent = label;
    this.el.state.style.color = color;

    const frac = Math.min(1, f.boxEnergy / 30);
    this.el.energyFill.style.width = `${(frac * 100).toFixed(1)}%`;
    this.el.energyFill.style.background =
      frac > 0.8
        ? "linear-gradient(90deg, #fbbf24, #f472b6)"
        : "linear-gradient(90deg, #22d3ee, #34d399)";
  }
}
