// Apply the saved theme before the app or its stylesheet renders.
(() => {
  let theme = 'light';
  try {
    const saved = localStorage.getItem('sweety.theme');
    if (saved === 'dark') theme = 'dark';
  } catch { /* Use light when storage is blocked. */ }
  document.documentElement.dataset.theme = theme;
})();
