const copyButton = document.querySelector('#copy-citation');
const demoFrame = document.querySelector('.demo-frame iframe');

function softenDemoChrome() {
  try {
    const frameDocument = demoFrame?.contentDocument;
    if (!frameDocument?.documentElement || !frameDocument.body) return;
    frameDocument.documentElement.style.setProperty('background', '#f5f3ed', 'important');
    frameDocument.body.style.setProperty('background', '#f5f3ed', 'important');
    let style = frameDocument.querySelector('#igg-site-embed-style');
    if (!style) {
      style = frameDocument.createElement('style');
      style.id = 'igg-site-embed-style';
      style.textContent = '[data-igg="nav"], [data-igg="dots"] { opacity: .22 !important; transition: opacity .2s ease; }';
      frameDocument.head?.appendChild(style);
    }
  } catch {
    // The standalone animation remains usable if browser isolation blocks styling.
  }
}

demoFrame?.addEventListener('load', () => {
  softenDemoChrome();
  window.setTimeout(softenDemoChrome, 800);
  window.setTimeout(softenDemoChrome, 2400);
});

copyButton?.addEventListener('click', async () => {
  const citation = document.querySelector('.code-wrap code')?.textContent ?? '';
  await navigator.clipboard.writeText(citation);
  copyButton.textContent = 'Copied';
  window.setTimeout(() => { copyButton.textContent = 'Copy'; }, 1400);
});
