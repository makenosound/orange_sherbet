// AUTO-GENERATED from todo_footer.html.erb — do not edit.
const __esc = (v) =>
  v == null
    ? ""
    : String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const __s = (v) => (v == null ? "" : String(v));
const __truthy = (v) => v != null && v !== false;

export default function todo_footer(locals = {}) {
  const { active, filter, has_completed } = locals;
  let __o = "";
  __o += `<footer class="footer">
  <span class="todo-count">
    <strong>`;
  __o += __esc(active);
  __o += `</strong> `;
  __o += __esc(__truthy(active === 1) ? "item" : "items");
  __o += ` left
  </span>
  <ul class="filters">
    <li><a class="`;
  __o += __esc(__truthy(filter === "all") ? "selected" : "");
  __o += `" href="#/">All</a></li>
    <li><a class="`;
  __o += __esc(__truthy(filter === "active") ? "selected" : "");
  __o += `" href="#/active">Active</a></li>
    <li>
      <a class="`;
  __o += __esc(__truthy(filter === "completed") ? "selected" : "");
  __o += `" href="#/completed">Completed</a>
    </li>
  </ul>
`;
  if (__truthy(has_completed)) {
    __o += `    <button class="clear-completed">Clear completed</button>
`;
  }
  __o += `</footer>
`;
  return __o;
}
//# sourceMappingURL=todo_footer.js.map
