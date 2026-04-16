export class VaultError extends Error {
  public readonly reason?: unknown
  constructor(message: string, reason?: unknown) {
    super(message)
    this.name = 'VaultError'
    this.reason = reason
  }
}

export class VaultSealError extends VaultError {
  constructor(message = 'Failed to seal payload', cause?: unknown) {
    super(message, cause)
    this.name = 'VaultSealError'
  }
}

export class VaultOpenError extends VaultError {
  constructor(message = 'Failed to open sealed payload', cause?: unknown) {
    super(message, cause)
    this.name = 'VaultOpenError'
  }
}

export class VaultNotReadyError extends VaultError {
  constructor(message = 'Vault is not initialised — call ready() first') {
    super(message)
    this.name = 'VaultNotReadyError'
  }
}
