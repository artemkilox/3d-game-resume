export const WHEEL_ORDER = [
  "wheel-front-left",
  "wheel-front-right",
  "wheel-back-left",
  "wheel-back-right",
] as const;

export type WheelName = (typeof WHEEL_ORDER)[number];

type WheelSetup = Record<WheelName, [number, number, number]>;

type ChassisSetup = {
  half: [number, number, number];
  center: [number, number, number];
};

export const CARS = [
  {
    id: "race",
    label: "Race",
    url: "/models/race.glb",
    wheels: {
      "wheel-front-left": [0.35, 0.3, 0.64],
      "wheel-front-right": [-0.35, 0.3, 0.64],
      "wheel-back-left": [0.35, 0.3, -0.88],
      "wheel-back-right": [-0.35, 0.3, -0.88],
    } satisfies WheelSetup,
    chassis: { half: [0.58, 0.22, 1.16], center: [0, 0.42, -0.08] } satisfies ChassisSetup,
  },
  {
    id: "sedan",
    label: "Sedan",
    url: "/models/sedan.glb",
    wheels: {
      "wheel-front-left": [0.3, 0.3, 0.66],
      "wheel-front-right": [-0.3, 0.3, 0.66],
      "wheel-back-left": [0.3, 0.3, -0.66],
      "wheel-back-right": [-0.3, 0.3, -0.66],
    } satisfies WheelSetup,
    chassis: { half: [0.7, 0.32, 1.16], center: [0, 0.56, 0] } satisfies ChassisSetup,
  },
  {
    id: "sedan-sports",
    label: "Sedan Sports",
    url: "/models/sedan-sports.glb",
    wheels: {
      "wheel-front-left": [0.3, 0.3, 0.66],
      "wheel-front-right": [-0.3, 0.3, 0.66],
      "wheel-back-left": [0.3, 0.3, -0.66],
      "wheel-back-right": [-0.3, 0.3, -0.66],
    } satisfies WheelSetup,
    chassis: { half: [0.64, 0.3, 1.16], center: [0, 0.54, 0] } satisfies ChassisSetup,
  },
] as const;

export type CarId = (typeof CARS)[number]["id"];
export type CarConfig = (typeof CARS)[number];
