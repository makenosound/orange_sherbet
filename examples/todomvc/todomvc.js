// TodoMVC with defo's update() driving the individual todo items.
//
//   todomvcViewFn  the root. Owns state (a closure) and the reducer. Items and
//                  controls talk to it with bubbling intents (the main reducer
//                  is event-driven, not attribute-driven). On a change it
//                  reconciles the <ul>: it sets each <li>'s data-defo-todo-item
//                  attribute to that todo's JSON, adds <li>s for new todos, and
//                  removes them for gone ones.
//
//   todoItemViewFn defo binds it to each <li>. The <li>'s data-defo-todo-item
//                  attribute is the item's props; defo calls the item's
//                  update(todo) whenever that attribute changes, and the item
//                  re-renders its own content from it (Orange Sherbet's
//                  todo_item_content). It emits intents up and owns edit mode.
//
//   reduce         pure state transitions (no DOM)
//
// @icelab/defo resolves via the import map in index.html (and node_modules
// under test).
import todoItem from "./compiled/todo_item.js";
import todoItemContent from "./compiled/todo_item_content.js";
import todoFooter from "./compiled/todo_footer.js";

const STORAGE_KEY = "orange-sherbet-todomvc";

const seedTodos = () => [
  { id: 1, title: "Taste the orange sherbet", completed: true },
  { id: 2, title: "Render this list with Orange Sherbet", completed: false },
];

const loadTodos = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? seedTodos();
  } catch {
    return seedTodos();
  }
};

const filterFromHash = () => {
  const hash = location.hash.replace(/^#\//, "");
  return hash === "active" || hash === "completed" ? hash : "all";
};

const nextId = (todos) => todos.reduce((max, t) => Math.max(max, t.id), 0) + 1;

const visible = (state) =>
  state.todos.filter((t) =>
    state.filter === "active" ? !t.completed : state.filter === "completed" ? t.completed : true,
  );

const parse = (html) => {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
};

// --- pure state transitions ------------------------------------------------

export const reduce = (state, action) => {
  switch (action.type) {
    case "add":
      return {
        ...state,
        todos: [...state.todos, { id: nextId(state.todos), title: action.title, completed: false }],
      };
    case "toggle":
      return {
        ...state,
        todos: state.todos.map((t) => (t.id === action.id ? { ...t, completed: !t.completed } : t)),
      };
    case "edit":
      return { ...state, editing: action.id };
    case "cancel":
      return { ...state, editing: null };
    case "save":
      return {
        ...state,
        editing: null,
        todos: state.todos.map((t) => (t.id === action.id ? { ...t, title: action.title } : t)),
      };
    case "destroy":
      return {
        ...state,
        editing: state.editing === action.id ? null : state.editing,
        todos: state.todos.filter((t) => t.id !== action.id),
      };
    case "toggleAll":
      return { ...state, todos: state.todos.map((t) => ({ ...t, completed: action.completed })) };
    case "clearCompleted":
      return { ...state, todos: state.todos.filter((t) => !t.completed) };
    case "filter":
      return { ...state, filter: action.filter };
    default:
      return state;
  }
};

// --- per-item view: props in via the attribute, intents out via events -----

export const todoItemViewFn = (li, props) => {
  const id = props.id;
  const emit = (type, detail) => li.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
  const editValue = () => li.querySelector(".edit").value.trim();

  // All interactions are intents — edit mode is state, owned by the reducer.
  const onChange = (event) => {
    if (event.target.matches(".toggle")) emit("todo:toggle", { id });
  };
  const onClick = (event) => {
    if (event.target.matches(".destroy")) emit("todo:destroy", { id });
  };
  const onDblclick = (event) => {
    if (event.target.matches("label")) emit("todo:edit", { id });
  };
  const onKeydown = (event) => {
    if (!event.target.matches(".edit")) return;
    if (event.key === "Enter") emit("todo:save", { id, title: editValue() });
    else if (event.key === "Escape") emit("todo:cancel", { id });
  };
  const onBlur = (event) => {
    // Only commit if still editing — the state-driven exit removes the .editing
    // class before the input is replaced, so this won't double-fire after Enter.
    if (event.target.matches(".edit") && li.classList.contains("editing")) {
      emit("todo:save", { id, title: editValue() });
    }
  };

  // Listeners live on the <li>, so they survive the content being re-rendered.
  li.addEventListener("change", onChange);
  li.addEventListener("click", onClick);
  li.addEventListener("dblclick", onDblclick);
  li.addEventListener("keydown", onKeydown);
  li.addEventListener("blur", onBlur, true);

  return {
    // defo calls this when data-defo-todo-item changes. The item reflects its
    // props, including `editing`: entering edit focuses the field; otherwise it
    // re-renders its content. Entering only fires on the false→true transition,
    // so an in-progress edit isn't reset by an unrelated re-render.
    update(todo) {
      li.classList.toggle("completed", todo.completed);
      if (todo.editing) {
        if (!li.classList.contains("editing")) {
          li.classList.add("editing");
          const edit = li.querySelector(".edit");
          edit.value = todo.title;
          edit.focus();
          edit.setSelectionRange(edit.value.length, edit.value.length);
        }
      } else {
        li.classList.remove("editing");
        li.innerHTML = todoItemContent({ todo });
      }
    },
    destroy() {
      li.removeEventListener("change", onChange);
      li.removeEventListener("click", onClick);
      li.removeEventListener("dblclick", onDblclick);
      li.removeEventListener("keydown", onKeydown);
      li.removeEventListener("blur", onBlur, true);
    },
  };
};

// --- root view: state + reducer + list reconciliation ----------------------

export const todomvcViewFn = (root) => {
  let state = { todos: loadTodos(), filter: filterFromHash(), editing: null };

  const listMount = root.querySelector(".list-mount");
  const footerMount = root.querySelector(".footer-mount");
  const main = root.querySelector(".main");
  const toggleAll = root.querySelector(".toggle-all");
  const newTodo = root.querySelector(".new-todo");

  const ensureList = () => {
    let ul = listMount.querySelector(".todo-list");
    if (!ul) {
      ul = document.createElement("ul");
      ul.className = "todo-list";
      listMount.appendChild(ul);
    }
    return ul;
  };

  // Reconcile <li>s by id. Existing items get their attribute updated (which
  // makes defo call the item's update(todo)); new ones are created; gone ones
  // are removed. The root never renders item content itself.
  const reconcile = (todos) => {
    const ul = ensureList();
    const present = new Map([...ul.children].map((li) => [li.dataset.id, li]));
    const wanted = new Set();

    todos.forEach((todo, i) => {
      const key = String(todo.id);
      wanted.add(key);
      let li = present.get(key);
      // The item's props include whether *this* todo is the one being edited.
      const props = { ...todo, editing: todo.id === state.editing };
      const json = JSON.stringify(props);
      if (!li) {
        li = parse(todoItem({ todo: props })); // full <li> incl. content + attribute
      } else if (li.getAttribute("data-defo-todo-item") !== json) {
        li.setAttribute("data-defo-todo-item", json); // → defo → item.update(props)
      }
      if (ul.children[i] !== li) ul.insertBefore(li, ul.children[i] ?? null);
    });

    [...ul.children].forEach((li) => {
      if (!wanted.has(li.dataset.id)) li.remove();
    });
  };

  const render = () => {
    const has = state.todos.length > 0;
    const active = state.todos.filter((t) => !t.completed).length;
    main.hidden = !has;
    footerMount.innerHTML = has
      ? todoFooter({ active, filter: state.filter, has_completed: state.todos.some((t) => t.completed) })
      : "";
    toggleAll.checked = has && active === 0;
    reconcile(visible(state));
  };

  const dispatch = (action) => {
    state = reduce(state, action);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos));
    render();
  };

  const onToggle = (event) => dispatch({ type: "toggle", id: event.detail.id });
  const onEdit = (event) => dispatch({ type: "edit", id: event.detail.id });
  const onCancel = (event) => dispatch({ type: "cancel" });
  const onSave = (event) => {
    const { id, title } = event.detail;
    dispatch(title ? { type: "save", id, title } : { type: "destroy", id });
  };
  const onDestroy = (event) => dispatch({ type: "destroy", id: event.detail.id });
  const onKeydown = (event) => {
    if (event.target.matches(".new-todo") && event.key === "Enter") {
      const title = event.target.value.trim();
      if (!title) return;
      dispatch({ type: "add", title });
      event.target.value = "";
    }
  };
  const onChange = (event) => {
    if (event.target.matches(".toggle-all")) dispatch({ type: "toggleAll", completed: event.target.checked });
  };
  const onClick = (event) => {
    if (event.target.matches(".clear-completed")) dispatch({ type: "clearCompleted" });
  };
  const onHashchange = () => dispatch({ type: "filter", filter: filterFromHash() });

  root.addEventListener("todo:toggle", onToggle);
  root.addEventListener("todo:edit", onEdit);
  root.addEventListener("todo:cancel", onCancel);
  root.addEventListener("todo:save", onSave);
  root.addEventListener("todo:destroy", onDestroy);
  root.addEventListener("keydown", onKeydown);
  root.addEventListener("change", onChange);
  root.addEventListener("click", onClick);
  window.addEventListener("hashchange", onHashchange);

  render();
  newTodo.focus();

  return {
    destroy() {
      root.removeEventListener("todo:toggle", onToggle);
      root.removeEventListener("todo:edit", onEdit);
      root.removeEventListener("todo:cancel", onCancel);
      root.removeEventListener("todo:save", onSave);
      root.removeEventListener("todo:destroy", onDestroy);
      root.removeEventListener("keydown", onKeydown);
      root.removeEventListener("change", onChange);
      root.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHashchange);
    },
  };
};
