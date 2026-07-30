// CANARY — deliberate type error. Delete with the branch.
export function canaryTypeError(): number {
  const wrong: string = 42;
  return wrong;
}
