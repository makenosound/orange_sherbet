// AUTO-GENERATED from todo_list.html.erb — do not edit.
import todo_item from "./todo_item.js";
const __esc = (v) =>
  v == null
    ? ""
    : String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const __s = (v) => (v == null ? "" : String(v));
const __truthy = (v) => v != null && v !== false;

export default function todo_list(locals = {}) {
  const { editing, todos } = locals;
  let __o = "";
  __o += `<ul class="todo-list">
`;
  todos.forEach((todo) => {
    __o += `    `;
    __o += __s(todo_item({ todo: todo, editing: editing }));
    __o += `
`;
  });
  __o += `</ul>
`;
  return __o;
}
//# sourceMappingURL=todo_list.js.map
