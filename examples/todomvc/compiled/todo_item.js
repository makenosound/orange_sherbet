// AUTO-GENERATED from todo_item.html.erb — do not edit.
import todo_item_content from "./todo_item_content.js";
const __esc = (v) =>
  v == null
    ? ""
    : String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const __s = (v) => (v == null ? "" : String(v));
const __truthy = (v) => v != null && v !== false;

export default function todo_item(locals = {}) {
  const { todo } = locals;
  let __o = "";
  __o += `<li class="`;
  __o += __esc(__truthy(todo.completed) ? "completed" : "");
  __o += `" id="todo-`;
  __o += __esc(todo.id);
  __o += `" data-id="`;
  __o += __esc(todo.id);
  __o += `" data-defo-todo-item="`;
  __o += __esc(JSON.stringify(todo));
  __o += `">`;
  __o += __s(todo_item_content({ todo: todo }));
  __o += `</li>
`;
  return __o;
}
//# sourceMappingURL=todo_item.js.map
