
import { strict as assert } from "node:assert";
import { compatible, describe } from "../lib/competencia/normalize";

const cases = [
  {
    a: "Fireball Cinnamon Whisky 750 ML",
    b: "FIREBALL WHISKY 0.75L",
    expected: true,
  },
  {
    a: "Whisky Johnnie Walker Black Label 750 ml",
    b: "Whisky Johnnie Walker Double Black 750 ml",
    expected: false,
  },
  {
    a: "Whisky Jack Daniels Fire 750 ml",
    b: "Whisky Jack Daniels Apple 750 ml",
    expected: false,
  },
  {
    a: "Whisky Johnnie Walker Black Label 750 ml",
    b: "Whisky Johnnie Walker Black Label 1000 ml",
    expected: false,
  },
  {
    a: "Whisky Johnnie Walker Black Label 750 ml",
    b: "Whisky Johnnie Walker Black Label 750 ml",
    expected: true,
  },
];

for (const test of cases) {
  const result = compatible(
    describe(test.a),
    describe(test.b)
  );

  assert.equal(
    result,
    test.expected,
    `${test.a} vs ${test.b}`
  );

  console.log(
    `${result === test.expected ? "OK" : "ERROR"}: ${test.a} / ${test.b}`
  );
}

console.log("Pruebas de compatibilidad completadas.");
