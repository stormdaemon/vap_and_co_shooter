// Announcer: browser speech synthesis (French voice when available), throttled, optional.
export class Announcer {
  constructor() { this.enabled = true; this.last = 0; this.queue = 0; this.voice = null; this.ok = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'; if (this.ok) { const pick = () => { const vs = speechSynthesis.getVoices(); this.voice = vs.find(v => /fr/i.test(v.lang) && /google|natural|premium/i.test(v.name)) || vs.find(v => /fr/i.test(v.lang)) || null; }; pick(); speechSynthesis.onvoiceschanged = pick; } }
  // priority: 0 chatter (dropped when busy), 1 normal, 2 important (cancels current)
  say(text, { pitch = 1, rate = 1.05, priority = 1 } = {}) {
    if (!this.enabled || !this.ok || !text) return;
    const now = performance.now();
    if (priority === 0 && (speechSynthesis.speaking || now - this.last < 2500)) return;
    if (priority === 2) speechSynthesis.cancel(); else if (speechSynthesis.pending) return;
    try { const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; if (this.voice) u.voice = this.voice; u.pitch = pitch; u.rate = rate; u.volume = 0.9; speechSynthesis.speak(u); this.last = now; } catch { /* ignore */ }
  }
  stop() { if (this.ok) speechSynthesis.cancel(); }
}
