// TodoMVC built the same way this repo's /todos page works: a defo viewFn bound
// to the root node (see main.js), with Orange Sherbet compiling the ERB
// templates to the JS render functions imported below. State lives here; every
// change re-renders the list and footer from the templates.
import todoList from "./compiled/todo_list.js";
import todoFooter from "./compiled/todo_footer.js";

const STORAGE_KEY = "orange-sherbet-todomvc";

const seed = () => [
  { id: 1, title: "Taste the orange sherbet", completed: true },
  { id: 2, title: "Render this list with Orange Sherbet", completed: false },
];

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? seed();
  } catch {
    return seed();
  }
};

const filterFromHash = () => {
  const hash = location.hash.replace(/^#\//, "");
  return hash === "active" || hash === "completed" ? hash : "all";
};

export const todomvcViewFn = (root) => {
  let todos = load();
  let nextId = todos.reduce((max, t) => Math.max(max, t.id), 0) + 1;
  let filter = filterFromHash();
  let editing = null;

  const listMount = root.querySelector(".list-mount");
  const footerMount = root.querySelector(".footer-mount");
  const main = root.querySelector(".main");
  const toggleAll = root.querySelector(".toggle-all");
  const newTodo = root.querySelector(".new-todo");

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  const activeCount = () => todos.filter((t) => !t.completed).length;
  const visible = () =>
    todos.filter((t) => (filter === "active" ? !t.completed : filter === "completed" ? t.completed : true));

  const render = () => {
    const has = todos.length > 0;
    main.hidden = !has;
    footerMount.innerHTML = has
      ? todoFooter({ active: activeCount(), filter, has_completed: todos.some((t) => t.completed) })
      : "";
    listMount.innerHTML = todoList({ todos: visible(), editing });
    toggleAll.checked = has && activeCount() === 0;
    if (editing != null) {
      const input = listMount.querySelector(`li[data-id="${editing}"] .edit`);
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  };

  const update = (mutate) => {
    mutate();
    save();
    render();
  };

  const idOf = (el) => Number(el.closest("li[data-id]").dataset.id);

  const commitEdit = (input) => {
    if (editing == null) return;
    const title = input.value.trim();
    const id = editing;
    update(() => {
      const todo = todos.find((t) => t.id === id);
      if (!title) {
        todos = todos.filter((t) => t.id !== id);
      } else if (todo) {
        todo.title = title;
      }
      editing = null;
    });
  };

  const onKeydown = (event) => {
    const target = event.target;
    if (target.matches(".new-todo") && event.key === "Enter") {
      const title = target.value.trim();
      if (!title) return;
      update(() => todos.push({ id: nextId++, title, completed: false }));
      target.value = "";
    } else if (target.matches(".edit") && event.key === "Enter") {
      commitEdit(target);
    } else if (target.matches(".edit") && event.key === "Escape") {
      editing = null;
      render();
    }
  };

  const onChange = (event) => {
    const target = event.target;
    if (target.matches(".toggle")) {
      const id = idOf(target);
      update(() => {
        const todo = todos.find((t) => t.id === id);
        if (todo) todo.completed = target.checked;
      });
    } else if (target.matches(".toggle-all")) {
      const completed = target.checked;
      update(() => todos.forEach((t) => (t.completed = completed)));
    }
  };

  const onClick = (event) => {
    const target = event.target;
    if (target.matches(".destroy")) {
      const id = idOf(target);
      update(() => (todos = todos.filter((t) => t.id !== id)));
    } else if (target.matches(".clear-completed")) {
      update(() => (todos = todos.filter((t) => !t.completed)));
    }
  };

  const onDblclick = (event) => {
    if (event.target.matches("label")) {
      editing = idOf(event.target);
      render();
    }
  };

  const onBlur = (event) => {
    if (event.target.matches(".edit")) commitEdit(event.target);
  };

  const onHashchange = () => {
    filter = filterFromHash();
    render();
  };

  root.addEventListener("keydown", onKeydown);
  root.addEventListener("change", onChange);
  root.addEventListener("click", onClick);
  root.addEventListener("dblclick", onDblclick);
  root.addEventListener("blur", onBlur, true); // capture: blur doesn't bubble
  window.addEventListener("hashchange", onHashchange);

  render();
  newTodo.focus();

  return {
    destroy() {
      root.removeEventListener("keydown", onKeydown);
      root.removeEventListener("change", onChange);
      root.removeEventListener("click", onClick);
      root.removeEventListener("dblclick", onDblclick);
      root.removeEventListener("blur", onBlur, true);
      window.removeEventListener("hashchange", onHashchange);
    },
  };
};
