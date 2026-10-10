---
import { buildProfitResponse, writeBotMemory } from "../lib/site-bot-engine";
---

<div class="profit-console">
  <section class="console-panel" aria-labelledby="bot-heading">
    <div class="panel-heading">
      <span class="bot-section-label">01 / Ask the Matrix</span>
      <h3 id="bot-heading">Local Profit Assistant</h3>
      <p>Ask about affiliate marketing, digital products, traffic, crypto, or monetization.</p>
    </div>
    <div class="chat-log" id="profit-chat" aria-live="polite" aria-label="Chat messages">
      <div class="message bot-message"><p>I can share practical starting points. What would you like to explore?</p></div>
    </div>
    <form class="chat-form" id="profit-chat-form">
      <label class="sr-only" for="profit-question">Ask a question</label>
      <input id="profit-question" name="question" type="text" maxlength="500" placeholder="Ask about growing or earning…" autocomplete="off" required />
      <button type="submit">Send</button>
    </form>
    <p class="local-note">Runs locally in your browser. No remote AI or data transmission.</p>
  </section>

  <section class="console-panel" aria-labelledby="ideas-heading">
    <div class="panel-heading">
      <span class="bot-section-label">02 / Monetization ideas</span>
      <h3 id="ideas-heading">Choose a starting point</h3>
    </div>
    <div class="ideas-grid">
      <article class="idea-card">
        <h4>Free web tools</h4>
        <p class="idea-model">Relevant affiliate links or optional paid features</p>
        <p><strong>Effort:</strong> Medium</p>
        <p>Build one tool that solves a real visitor problem.</p>
      </article>
      <article class="idea-card">
        <h4>Digital downloads</h4>
        <p class="idea-model">Templates, guides, or design assets</p>
        <p><strong>Effort:</strong> Low to medium</p>
        <p>Create a useful downloadable product and test demand.</p>
      </article>
      <article class="idea-card">
        <h4>Affiliate content</h4>
        <p class="idea-model">Commission on qualifying referrals</p>
        <p><strong>Effort:</strong> Medium</p>
        <p>Publish honest comparisons and tutorials for relevant products.</p>
      </article>
      <article class="idea-card">
        <h4>Premium utilities</h4>
        <p class="idea-model">Paid upgrades or licenses</p>
        <p><strong>Effort:</strong> High</p>
        <p>Validate demand before building paid functionality.</p>
      </article>
    </div>
  </section>

  <section class="console-panel" aria-labelledby="calculator-heading">
    <div class="panel-heading">
      <span class="bot-section-label">03 / Revenue estimate</span>
      <h3 id="calculator-heading">Affiliate calculator</h3>
      <p>A simple estimate based on your traffic and assumptions, not a promise of earnings.</p>
    </div>
    <form class="calculator-form" id="profit-calculator">
      <label>
        Monthly visitors
        <input name="visitors" type="number" min="0" max="100000000" step="1" value="1000" />
      </label>
      <label>
        Click-through rate (%)
        <input name="clickRate" type="number" min="0" max="100" step="0.1" value="5" />
      </label>
      <label>
        Conversion rate (%)
        <input name="conversionRate" type="number" min="0" max="100" step="0.1" value="3" />
      </label>
      <label>
        Commission per sale ($)
        <input name="commission" type="number" min="0" max="1000000" step="0.01" value="10" />
      </label>
    </form>
    <p class="estimate-label">Estimated monthly commission</p>
    <output class="estimate" id="profit-estimate" for="profit-calculator">$15.00</output>
  </section>
</div>

<script>
  const chatForm = document.querySelector('#profit-chat-form');
  const questionInput = document.querySelector('#profit-question');
  const chatLog = document.querySelector('#profit-chat');
  const calculator = document.querySelector('#profit-calculator');
  const estimate = document.querySelector('#profit-estimate');

  function appendMessage(message, className) {
    const bubble = document.createElement('div');
    bubble.className = `message ${className}`;
    const paragraph = document.createElement('p');
    paragraph.textContent = message;
    bubble.append(paragraph);
    chatLog.append(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function respond(question) {
    const answer = buildProfitResponse(question, { roomId: 'profit' });
    writeBotMemory('profit', question, answer);
    return answer;
  }

  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const question = questionInput.value.trim();
    if (!question) return;
    appendMessage(question, 'user-message');
    appendMessage(respond(question), 'bot-message');
    chatForm.reset();
    questionInput.focus();
  });

  function updateEstimate() {
    const values = new FormData(calculator);
    const numberFrom = (name, max) => {
      const value = Number(values.get(name));
      return Number.isFinite(value) ? Math.min(Math.max(value, 0), max) : 0;
    };
    const visitors = numberFrom('visitors', 100000000);
    const clickRate = numberFrom('clickRate', 100) / 100;
    const conversionRate = numberFrom('conversionRate', 100) / 100;
    const commission = numberFrom('commission', 1000000);
    estimate.textContent = (visitors * clickRate * conversionRate * commission).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  }

  calculator.addEventListener('input', updateEstimate);
</script>

<style>
  .profit-console {
    --bot-green: #00ff65;
    --bot-muted: rgba(200, 255, 200, 0.62);
    display: grid;
    gap: 1.25rem;
    color: #d6f5dc;
    font-family: var(--font, monospace);
  }

  .console-panel {
    padding: clamp(1.1rem, 3vw, 1.75rem);
    background: rgba(4, 15, 9, 0.96);
    border: 1px solid rgba(0, 255, 101, 0.24);
    border-radius: 5px;
    box-shadow: 0 0 28px rgba(0, 255, 65, 0.06);
  }

  .panel-heading { margin-bottom: 1.25rem; }
  .bot-section-label {
    display: inline-block;
    margin-bottom: 0.55rem;
    color: var(--bot-green);
    font-size: 0.7rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .panel-heading h3 {
    margin: 0 0 0.5rem;
    color: #e8ffec;
    font-size: 1.15rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .panel-heading p, .local-note {
    margin: 0;
    color: var(--bot-muted);
    font-size: 0.85rem;
    line-height: 1.6;
  }

  .chat-log {
    display: grid;
    gap: 0.75rem;
    max-height: 16rem;
    margin-bottom: 1rem;
    overflow-y: auto;
  }

  .chat-log .message {
    padding: 0.8rem 1rem;
    border-radius: 4px;
    font-size: 0.85rem;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .chat-log .message p { margin: 0; }
  .chat-log .bot-message { background: rgba(16, 45, 27, 0.8); border-left: 2px solid var(--bot-green); }
  .chat-log .user-message { background: rgba(20, 37, 27, 0.9); border-left: 2px solid #769c83; }

  .chat-form { display: flex; gap: 0.6rem; }
  .chat-form input, .calculator-form input {
    min-width: 0;
    padding: 0.75rem;
    color: #e8ffec;
    background: #07110a;
    border: 1px solid rgba(0, 255, 101, 0.3);
    border-radius: 3px;
    font: inherit;
  }

  .chat-form input { flex: 1; }
  .chat-form button {
    padding: 0.65rem 1rem;
    color: #07110a;
    background: var(--bot-green);
    border: 0;
    border-radius: 3px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .local-note { margin-top: 0.65rem; font-size: 0.72rem; }
  .ideas-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; }
  .idea-card {
    padding: 1rem;
    background: rgba(10, 28, 16, 0.8);
    border: 1px solid rgba(0, 255, 101, 0.15);
    border-radius: 3px;
  }

  .idea-card h4 { margin: 0 0 0.5rem; color: var(--bot-green); font-size: 0.9rem; }
  .idea-card p { margin: 0.4rem 0 0; color: var(--bot-muted); font-size: 0.78rem; line-height: 1.5; }
  .idea-card .idea-model { color: #e8ffec; }
  .calculator-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.8rem; }
  .calculator-form label { display: grid; gap: 0.4rem; color: var(--bot-muted); font-size: 0.78rem; }
  .estimate-label { margin: 1.1rem 0 0.2rem; color: var(--bot-muted); font-size: 0.8rem; }
  .estimate { color: var(--bot-green); font-size: clamp(1.5rem, 5vw, 2rem); font-weight: 700; }
  .sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }
</style>
