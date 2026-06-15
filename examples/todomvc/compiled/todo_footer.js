// AUTO-GENERATED from todo_footer.html.erb — do not edit.
import { __esc, __truthy } from "./__runtime.js";

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
