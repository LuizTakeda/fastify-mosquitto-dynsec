export class DynsecError extends Error {
  public readonly command?: string;

  constructor(message: string, command?: string) {
    super(message);
    this.name = "DynsecError";
    this.command = command;
  }
}
