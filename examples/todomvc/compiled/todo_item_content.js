// AUTO-GENERATED from todo_item_content.html.erb — do not edit.
const __esc = (v) =>
  v == null
    ? ""
    : String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const __s = (v) => (v == null ? "" : String(v));
const __truthy = (v) => v != null && v !== false;

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
