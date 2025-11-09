import * as http from "http";
import { runServer } from "../server";
import { store } from "../store/store";
import { UserData } from "../store/store";
import { validate as idValidate } from "uuid";

const assert = require("assert");

const TEST_PORT = 4001;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Вспомогательная функция для выполнения HTTP запросов
const makeRequest = (
  method: string,
  path: string,
  data?: UserData
): Promise<{ statusCode: number; body: any }> => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        try {
          const parsedBody = body ? JSON.parse(body) : null;
          resolve({
            statusCode: res.statusCode || 0,
            body: parsedBody,
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode || 0,
            body: body,
          });
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
};

// Очистка store перед каждым тестом
const clearStore = () => {
  store.length = 0;
};

// Простая система тестирования
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

class TestRunner {
  private tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];
  private currentSuite = "";
  private results: TestResult[] = [];

  describe(name: string, fn: () => void) {
    this.currentSuite = name;
    fn();
    this.currentSuite = "";
  }

  test(name: string, fn: () => void | Promise<void>) {
    this.tests.push({
      name: this.currentSuite ? `${this.currentSuite} - ${name}` : name,
      fn,
    });
  }

  async run() {
    console.log("\n============ Запуск тестов ============\n");

    for (const test of this.tests) {
      clearStore(); // Очищаем store перед каждым тестом
      try {
        await test.fn();
        this.results.push({ name: test.name, passed: true });
        console.log(`✓ ${test.name}`);
      } catch (error: any) {
        this.results.push({
          name: test.name,
          passed: false,
          error: error.message || String(error),
        });
        console.log(`✗ ${test.name}`);
        console.log(`  Ошибка: ${error.message || String(error)}`);
      }
    }

    return this.printSummary();
  }

  private printSummary() {
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;
    const total = this.results.length;

    console.log("\n============ Результаты тестов ============");
    console.log(`Всего тестов: ${total}`);
    console.log(`Пройдено: ${passed}`);
    console.log(`Провалено: ${failed}`);

    if (failed > 0) {
      console.log("\nПроваленные тесты:");
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`  - ${r.name}: ${r.error}`);
        });
    } else {
      console.log("\nВсе тесты пройдены успешно! ✓\n");
    }

    return failed > 0 ? 1 : 0;
  }
}

// Функция для глубокого сравнения значений (массивы, объекты, примитивы)
const deepEqual = (a: any, b: any): boolean => {
  // Строгое сравнение примитивов
  if (a === b) {
    return true;
  }

  // Проверка на null или undefined
  if (a == null || b == null) {
    return a === b;
  }

  // Проверка типов
  if (typeof a !== typeof b) {
    return false;
  }

  // Сравнение массивов
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }

  // Сравнение объектов
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      if (!keysB.includes(key)) {
        return false;
      }
      if (!deepEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
};

// Простой expect для проверок
const expect = (actual: any) => {
  return {
    toBe: (expected: any) => {
      assert.strictEqual(
        actual,
        expected,
        `Ожидалось ${expected}, получено ${actual}`
      );
    },
    toHaveProperty: (prop: string, value?: any) => {
      assert(
        actual && typeof actual === "object" && prop in actual,
        `Объект не содержит свойства ${prop}`
      );
      if (value !== undefined) {
        assert.strictEqual(
          actual[prop],
          value,
          `Свойство ${prop} имеет значение ${actual[prop]}, ожидалось ${value}`
        );
      }
    },
    toMatchObject: (expected: any) => {
      for (const key in expected) {
        const actualValue = actual?.[key];
        const expectedValue = expected[key];
        const isEqual = deepEqual(actualValue, expectedValue);

        assert(
          actual && isEqual,
          `Свойство ${key} не совпадает. Ожидалось ${JSON.stringify(
            expectedValue
          )}, получено ${JSON.stringify(actualValue)}`
        );
      }
    },
    toBeGreaterThan: (expected: number) => {
      assert(
        actual > expected,
        `Ожидалось значение больше ${expected}, получено ${actual}`
      );
    },
    toBeLessThan: (expected: number) => {
      assert(
        actual < expected,
        `Ожидалось значение меньше ${expected}, получено ${actual}`
      );
    },
    toBeTruthy: () => {
      assert(actual, `Ожидалось truthy значение, получено ${actual}`);
    },
    toBeFalsy: () => {
      assert(!actual, `Ожидалось falsy значение, получено ${actual}`);
    },
  };
};

// Основной код тестов
const runner = new TestRunner();
let server: http.Server;

// Сценарий 1: Создание пользователя
runner.describe("Сценарий 1: Создание пользователя (POST /api/users)", () => {
  runner.test(
    "должен успешно создать пользователя с валидными данными",
    async () => {
      const userData: UserData = {
        username: "John Doe",
        age: 30,
        hobbies: ["reading", "swimming"],
      };

      const response = await makeRequest("POST", "/api/users", userData);

      expect(response.statusCode).toBe(201);
      expect(response.body).toHaveProperty("code", 201);
      expect(response.body).toHaveProperty("message", "Created");
      expect(response.body.data).toMatchObject({
        username: userData.username,
        age: userData.age,
        hobbies: userData.hobbies,
      });
      expect(response.body.data).toHaveProperty("id");
      expect(idValidate(response.body.data.id)).toBeTruthy();
      expect(store.length).toBe(1);
    }
  );

  runner.test("должен вернуть ошибку 400 при невалидных данных", async () => {
    const invalidData = {
      username: "",
      age: -5,
      hobbies: [],
    };

    const response = await makeRequest(
      "POST",
      "/api/users",
      invalidData as UserData
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("code", 400);
    expect(response.body).toHaveProperty("message", "Bad request");
    expect(store.length).toBe(0);
  });
});

// Сценарий 2: Получение пользователя по ID
runner.describe(
  "Сценарий 2: Получение пользователя по ID (GET /api/users/:id)",
  () => {
    runner.test(
      "должен успешно получить пользователя по существующему ID",
      async () => {
        // Сначала создаем пользователя
        const userData: UserData = {
          username: "Jane Smith",
          age: 25,
          hobbies: ["coding", "gaming"],
        };

        const createResponse = await makeRequest(
          "POST",
          "/api/users",
          userData
        );
        const userId = createResponse.body.data.id;

        // Получаем пользователя по ID
        const getResponse = await makeRequest("GET", `/api/users/${userId}`);

        expect(getResponse.statusCode).toBe(200);
        expect(getResponse.body).toHaveProperty("code", 200);
        expect(getResponse.body).toHaveProperty("message", "OK");
        expect(getResponse.body.data).toMatchObject({
          id: userId,
          username: userData.username,
          age: userData.age,
          hobbies: userData.hobbies,
        });
      }
    );

    runner.test(
      "должен вернуть ошибку 404 для несуществующего пользователя",
      async () => {
        const nonExistentId = "00000000-0000-0000-0000-000000000000";
        const response = await makeRequest(
          "GET",
          `/api/users/${nonExistentId}`
        );

        expect(response.statusCode).toBe(404);
        expect(response.body).toHaveProperty("code", 404);
        expect(response.body).toHaveProperty("message", "Not found");
      }
    );

    runner.test("должен вернуть ошибку 400 для невалидного UUID", async () => {
      const invalidId = "invalid-id";
      const response = await makeRequest("GET", `/api/users/${invalidId}`);

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty("code", 400);
      expect(response.body).toHaveProperty("message", "Bad request");
    });
  }
);

// Сценарий 3: Обновление пользователя
runner.describe(
  "Сценарий 3: Обновление пользователя (PUT /api/users/:id)",
  () => {
    runner.test(
      "должен успешно обновить существующего пользователя",
      async () => {
        // Создаем пользователя
        const initialUserData: UserData = {
          username: "Bob Johnson",
          age: 35,
          hobbies: ["music"],
        };

        const createResponse = await makeRequest(
          "POST",
          "/api/users",
          initialUserData
        );
        const userId = createResponse.body.data.id;

        // Обновляем пользователя
        const updatedUserData: UserData = {
          username: "Bob Johnson Updated",
          age: 36,
          hobbies: ["music", "traveling"],
        };

        const updateResponse = await makeRequest(
          "PUT",
          `/api/users/${userId}`,
          updatedUserData
        );

        expect(updateResponse.statusCode).toBe(200);
        expect(updateResponse.body).toHaveProperty("code", 200);
        expect(updateResponse.body).toHaveProperty("message", "OK");
        expect(updateResponse.body.data).toMatchObject({
          id: userId,
          username: updatedUserData.username,
          age: updatedUserData.age,
          hobbies: updatedUserData.hobbies,
        });

        // Проверяем, что данные действительно обновились в store
        const userInStore = store.find((u) => u.id === userId);
        expect(userInStore).toMatchObject(updatedUserData);
      }
    );

    runner.test(
      "должен вернуть ошибку 404 при попытке обновить несуществующего пользователя",
      async () => {
        const nonExistentId = "00000000-0000-0000-0000-000000000000";
        const userData: UserData = {
          username: "Test User",
          age: 20,
          hobbies: ["test"],
        };

        const response = await makeRequest(
          "PUT",
          `/api/users/${nonExistentId}`,
          userData
        );

        expect(response.statusCode).toBe(404);
        expect(response.body).toHaveProperty("code", 404);
        expect(response.body).toHaveProperty("message", "Not found");
      }
    );
  }
);

// Дополнительные тесты
runner.describe("Дополнительные сценарии", () => {
  runner.test(
    "должен получить всех пользователей (GET /api/users)",
    async () => {
      // Создаем несколько пользователей
      const user1: UserData = {
        username: "User 1",
        age: 20,
        hobbies: ["hobby1"],
      };
      const user2: UserData = {
        username: "User 2",
        age: 25,
        hobbies: ["hobby2"],
      };

      await makeRequest("POST", "/api/users", user1);
      await makeRequest("POST", "/api/users", user2);

      const response = await makeRequest("GET", "/api/users");

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty("code", 200);
      expect(response.body).toHaveProperty("data");
      assert(Array.isArray(response.body.data), "data должен быть массивом");
      expect(response.body.data.length).toBe(2);
    }
  );

  runner.test(
    "должен успешно удалить пользователя (DELETE /api/users/:id)",
    async () => {
      // Создаем пользователя
      const userData: UserData = {
        username: "To Delete",
        age: 30,
        hobbies: ["delete"],
      };

      const createResponse = await makeRequest("POST", "/api/users", userData);
      const userId = createResponse.body.data.id;

      expect(store.length).toBe(1);

      // Удаляем пользователя
      const deleteResponse = await makeRequest(
        "DELETE",
        `/api/users/${userId}`
      );

      expect(deleteResponse.statusCode).toBe(204);
      expect(store.length).toBe(0);
    }
  );
});

// Запуск тестов
(async () => {
  // Запускаем сервер перед тестами
  server = runServer(TEST_PORT);
  // Даем серверу время на запуск
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Запускаем тесты
  const exitCode = await runner.run();

  // Останавливаем сервер после тестов
  if (server) {
    server.close(() => {
      process.exit(exitCode);
    });
  } else {
    process.exit(exitCode);
  }
})();
