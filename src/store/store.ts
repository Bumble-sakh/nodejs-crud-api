import cluster from 'cluster';

export interface UserData {
  username: string;
  age: number;
  hobbies: string[];
}

export interface User extends UserData {
  id: string;
}

type Store = User[];

export const store: Store = [];

export type StoreAction = 
  | { type: 'ADD'; user: User }
  | { type: 'UPDATE'; user: User }
  | { type: 'DELETE'; id: string }
  | { type: 'SYNC'; store: Store };

export const syncStore = (action: StoreAction) => {
  if (cluster.isPrimary) {
    // Рассылаем действие всем воркерам
    for (const id in cluster.workers) {
      cluster.workers[id]?.send(action);
    }
  } else {
    // Отправляем действие мастер-процессу для синхронизации
    process.send?.(action);
  }
};

export const applyStoreAction = (action: StoreAction) => {
  switch (action.type) {
    case 'ADD':
      if (!store.find((u) => u.id === action.user.id)) {
        store.push(action.user);
      }
      break;
    case 'UPDATE':
      const updateIndex = store.findIndex((u) => u.id === action.user.id);
      if (updateIndex !== -1) {
        store[updateIndex] = action.user;
      }
      break;
    case 'DELETE':
      const deleteIndex = store.findIndex((u) => u.id === action.id);
      if (deleteIndex !== -1) {
        store.splice(deleteIndex, 1);
      }
      break;
    case 'SYNC':
      store.length = 0;
      store.push(...action.store);
      break;
  }
};
