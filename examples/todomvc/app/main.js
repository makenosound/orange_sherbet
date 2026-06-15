// Register every view function with defo. defo binds each to its element by the
// data-defo-* attribute: app → .todoapp, newTodo → .new-todo, toggleAll →
// .toggle-all, and todoItem → each <li> as the app's render adds it.
import defo from "@icelab/defo";
import { appViewFn } from "./app.js";
import { newTodoViewFn } from "./new_todo.js";
import { toggleAllViewFn } from "./toggle_all.js";
import { todoItemViewFn } from "./todo_item.js";

defo({
  views: {
    app: appViewFn,
    newTodo: newTodoViewFn,
    toggleAll: toggleAllViewFn,
    todoItem: todoItemViewFn,
  },
});
