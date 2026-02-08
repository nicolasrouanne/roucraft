const MAX_VISIBLE_MESSAGES = 50;
const FADE_TIMEOUT = 8000; // messages fade after 8s when chat is closed

interface ChatEntry {
  element: HTMLDivElement;
  timestamp: number;
}

export class ChatUI {
  private container: HTMLDivElement;
  private messagesDiv: HTMLDivElement;
  private inputDiv: HTMLDivElement;
  private input: HTMLInputElement;
  private messages: ChatEntry[] = [];
  private isOpen = false;
  private fadeTimer: number | null = null;
  private onSend: ((message: string) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute;
      bottom: 16px;
      left: 16px;
      width: 420px;
      max-height: 300px;
      display: flex;
      flex-direction: column;
      pointer-events: none;
      z-index: 50;
    `;

    this.messagesDiv = document.createElement('div');
    this.messagesDiv.style.cssText = `
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 4px;
      scrollbar-width: none;
    `;
    this.messagesDiv.style.setProperty('-webkit-scrollbar', 'none');

    this.inputDiv = document.createElement('div');
    this.inputDiv.style.cssText = `
      display: none;
      padding: 4px;
      pointer-events: auto;
    `;

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.maxLength = 200;
    this.input.placeholder = 'Type a message...';
    this.input.style.cssText = `
      width: 100%;
      padding: 6px 10px;
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      color: #fff;
      font-size: 14px;
      font-family: 'Segoe UI', sans-serif;
      outline: none;
    `;

    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        this.submitMessage();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });

    this.inputDiv.appendChild(this.input);
    this.container.appendChild(this.messagesDiv);
    this.container.appendChild(this.inputDiv);
    parent.appendChild(this.container);

    this.scheduleFade();
  }

  setOnSend(callback: (message: string) => void): void {
    this.onSend = callback;
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.inputDiv.style.display = 'block';
    this.container.style.background = 'rgba(0, 0, 0, 0.4)';
    this.container.style.borderRadius = '6px';
    this.input.focus();
    this.showAllMessages();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.inputDiv.style.display = 'none';
    this.input.value = '';
    this.container.style.background = 'none';
    this.container.style.borderRadius = '0';
    this.input.blur();
    this.scheduleFade();
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  get chatOpen(): boolean {
    return this.isOpen;
  }

  addMessage(playerName: string, message: string): void {
    this.addEntry(`<b>${this.escapeHtml(playerName)}</b>: ${this.escapeHtml(message)}`);
  }

  addSystemMessage(message: string): void {
    this.addEntry(`<i style="color: #aaa;">${this.escapeHtml(message)}</i>`);
  }

  private addEntry(html: string): void {
    const el = document.createElement('div');
    el.style.cssText = `
      padding: 3px 6px;
      color: #fff;
      font-size: 13px;
      font-family: 'Segoe UI', sans-serif;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
      line-height: 1.3;
      word-wrap: break-word;
      transition: opacity 0.5s;
    `;
    el.innerHTML = html;

    this.messagesDiv.appendChild(el);
    this.messages.push({ element: el, timestamp: Date.now() });

    // Remove oldest if over limit
    while (this.messages.length > MAX_VISIBLE_MESSAGES) {
      const oldest = this.messages.shift();
      oldest?.element.remove();
    }

    // Scroll to bottom
    this.messagesDiv.scrollTop = this.messagesDiv.scrollHeight;

    if (!this.isOpen) {
      el.style.opacity = '1';
      this.scheduleFade();
    }
  }

  private submitMessage(): void {
    const text = this.input.value.trim();
    if (text && this.onSend) {
      this.onSend(text);
    }
    this.input.value = '';
    this.close();
  }

  private showAllMessages(): void {
    for (const entry of this.messages) {
      entry.element.style.opacity = '1';
    }
  }

  private scheduleFade(): void {
    if (this.fadeTimer !== null) {
      clearTimeout(this.fadeTimer);
    }
    this.fadeTimer = window.setTimeout(() => {
      if (!this.isOpen) {
        this.fadeOldMessages();
      }
    }, FADE_TIMEOUT);
  }

  private fadeOldMessages(): void {
    const cutoff = Date.now() - FADE_TIMEOUT;
    for (const entry of this.messages) {
      if (entry.timestamp < cutoff) {
        entry.element.style.opacity = '0';
      }
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  handleKeyDown(e: KeyboardEvent): boolean {
    if (e.key === 't' || e.key === 'T' || e.key === 'Enter') {
      if (!this.isOpen) {
        e.preventDefault();
        this.open();
        return true;
      }
    }
    return false;
  }
}
