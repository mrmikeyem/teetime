/**
 * Blocking inline script that sets the `.dark` class on <html> before
 * first paint, avoiding a flash of light theme on page load.
 *
 * Stored value: localStorage["ttt:theme"] = "light" | "dark" | "system"
 * Default if unset: "system" (follow OS preference).
 */
const SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('ttt:theme');
    var mode = stored === 'light' || stored === 'dark' ? stored : 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = mode === 'dark' || (mode === 'system' && prefersDark);
    if (dark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch (e) {}
})();
`;

export function ThemeScript() {
  // dangerouslySetInnerHTML is the only way to inline a synchronous script
  // inside a server component's <head>. Content is static, no injection risk.
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
