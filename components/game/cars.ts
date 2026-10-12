export const CARS = [
  { id: "race", label: "Race", url: "/models/race.glb" },
  { id: "sedan", label: "Sedan", url: "/models/sedan.glb" },
  { id: "sedan-sports", label: "Sedan Sports", url: "/models/sedan-sports.glb" },
] as const;

export type CarId = (typeof CARS)[number]["id"];
