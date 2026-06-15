// A tiny shared store: the reducer, the state, and dispatch/subscribe. Every
// view function imports `dispatch` and calls it directly — no event plumbing,
// because the store isn't trapped in a closure. `subscribe` lets the app
// re-render when the state changes.
//
// It's a module singleton (one store for the page), which is fine for this
// single-instance app; an app that needed several independent instances would
// instead scope a store per root.

const STORAGE_KEY = "orange-sherbet-todomvc";

const seedTodos = () => [
  {
    id: 1,
    title: "I’m going to go across the street and get you some orange sherbet",
    completed: true,
  },
  { id: 2, title: "I brought you your orange sher-bert", completed: true },
  { id: 3, title: "Render this list with Orange Sherbet", completed: false },
];

const loadTodos = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? seedTodos();
  } catch {
    return seedTodos();
  }
};

const nextId = (todos) => todos.reduce((max, t) => Math.max(max, t.id), 0) + 1;

export const filterFromHash = () => {
  const hash = location.hash.replace(/^#\//, "");
  return hash === "active" || hash === "completed" ? hash : "all";
};

// Pure state transitions, including edit mode.
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

let state;
const listeners = new Set();

// Reset to `initial` (or fresh state from storage) and drop subscribers. Called
// once at load, and by tests that want a deterministic starting state.
export const reset = (initial) => {
  state = initial ?? { todos: loadTodos(), filter: filterFromHash(), editing: null };
  listeners.clear();
};
reset();

export const getState = () => state;

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const dispatch = (action) => {
  state = reduce(state, action);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos));
  listeners.forEach((listener) => listener(state));
};
