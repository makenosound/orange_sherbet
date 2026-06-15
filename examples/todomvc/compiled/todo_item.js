// AUTO-GENERATED from todo_item.html.erb — do not edit.
import todo_item_content from "./todo_item_content.js";
import { __esc, __s, __truthy } from "./sherbet-runtime.js";

export default function todo_item(locals = {}) {
  const { todo } = locals;
  let __o = "";
  __o += `<li class="`;
  __o += __esc(__truthy(todo.completed) ? "completed" : "");
  __o += __esc(__truthy(todo.editing) ? " editing" : "");
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
