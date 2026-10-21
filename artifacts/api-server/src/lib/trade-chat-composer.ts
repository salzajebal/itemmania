// Plain JavaScript injected into the captured page; keep this independently testable.
export const TRADE_CHAT_COMPOSER_SCRIPT = String.raw`
function setupTradeChatComposer(textarea, sendButton, send) {
  if (!textarea) return;
  var composing = false;
  var pendingCompositionSend = false;
  var suppressHeldEnter = false;
  var compositionTimer = null;
  textarea.setAttribute('enterkeyhint', 'send');

  function flushCompositionSend() {
    if (!pendingCompositionSend || composing || compositionTimer !== null) return;
    // The final input event may follow compositionend. Read the committed value
    // in the next task, never from the composition keydown's unfinished value.
    compositionTimer = setTimeout(function() {
      compositionTimer = null;
      if (composing || !pendingCompositionSend) return;
      pendingCompositionSend = false;
      send();
    }, 0);
  }
  textarea.addEventListener('compositionstart', function() {
    composing = true;
    pendingCompositionSend = false;
    if (compositionTimer !== null) clearTimeout(compositionTimer);
    compositionTimer = null;
  });
  textarea.addEventListener('compositionend', function() {
    composing = false;
    flushCompositionSend();
  });
  textarea.addEventListener('input', function(event) {
    if (!event.isComposing) flushCompositionSend();
  });
  textarea.addEventListener('keydown', function(event) {
    if (event.key !== 'Enter') return;
    event.stopImmediatePropagation();
    if (event.shiftKey) return; // Keep native multiline/IME behavior.
    if (event.repeat) { event.preventDefault(); return; }
    if (event.isComposing || composing || event.keyCode === 229) {
      pendingCompositionSend = true;
      suppressHeldEnter = true;
      // Do not cancel the IME's default commit. compositionend sends once.
      // Some mobile keyboards report 229 for Send without a composition session.
      if (!composing && !event.isComposing) flushCompositionSend();
      return;
    }
    event.preventDefault();
    if (pendingCompositionSend || suppressHeldEnter) return;
    send();
  }, true);
  textarea.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') suppressHeldEnter = false;
  });
  if (sendButton) sendButton.addEventListener('click', function(event) {
    event.preventDefault();
    textarea.focus();
    if (composing || pendingCompositionSend) {
      pendingCompositionSend = true;
      flushCompositionSend();
    } else {
      send();
    }
  });
}
`;
