export type Poi = {
  id: number;
  x: number;
  z: number;
  label: string;
};

export const POIS: Poi[] = [
  { id: 1, x: -16, z: 18, label: "Точка интереса 1" },
  { id: 2, x: 18, z: 2, label: "Точка интереса 2" },
  { id: 3, x: 0, z: 32, label: "Точка интереса 3" },
  { id: 4, x: -30, z: -20, label: "Точка интереса 4" },
  { id: 5, x: 28, z: -26, label: "Точка интереса 5" },
];
