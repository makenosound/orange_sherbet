// AUTO-GENERATED from todo_list.html.erb — do not edit.
import todo_item from "./todo_item.js";
import { __s } from "./sherbet-runtime.js";

export default function todo_list(locals = {}) {
  const { todos } = locals;
  let __o = "";
  __o += `<ul class="todo-list">
`;
  todos.forEach((todo) => {
    __o += `    `;
    __o += __s(todo_item({ todo: todo }));
    __o += `
`;
  });
  __o += `</ul>
`;
  return __o;
}
//# sourceMappingURL=todo_list.js.map
