// AUTO-GENERATED from todo_item_content.html.erb — do not edit.
import { __esc, __truthy } from "./sherbet-runtime.js";

export default function todo_item_content(locals = {}) {
  const { todo } = locals;
  let __o = "";
  __o += `<div class="view">
  <input class="toggle" type="checkbox" `;
  __o += __esc(__truthy(todo.completed) ? "checked" : "");
  __o += `>
  <label>`;
  __o += __esc(todo.title);
  __o += `</label>
  <button class="destroy"></button>
</div>
<input class="edit" value="`;
  __o += __esc(todo.title);
  __o += `">
`;
  return __o;
}
//# sourceMappingURL=todo_item_content.js.map
