export interface AIUsageData {
  userId?: string
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
  dataType?: string
  operationId?: string
  endpoint?: string
  duration?: number
  success: boolean
}

export interface ValidationError {
  field: string
  message: string
  value: unknown
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export function validateAIUsageData(data: AIUsageData): ValidationResult {
  const errors: ValidationError[] = []

  // Validate model (required, max 50 chars)
  if (!data.model) {
    errors.push({
      field: 'model',
      message: 'Model is required',
      value: data.model,
    })
  } else if (data.model.length > 50) {
    errors.push({
      field: 'model',
      message: 'Model name exceeds 50 characters',
      value: data.model,
    })
  }

  // Validate inputTokens (required, non-negative integer)
  if (data.inputTokens === undefined || data.inputTokens === null) {
    errors.push({
      field: 'inputTokens',
      message: 'Input tokens is required',
      value: data.inputTokens,
    })
  } else if (!Number.isInteger(data.inputTokens) || data.inputTokens < 0) {
    errors.push({
      field: 'inputTokens',
      message: 'Input tokens must be a non-negative integer',
      value: data.inputTokens,
    })
  }

  // Validate outputTokens (required, non-negative integer)
  if (data.outputTokens === undefined || data.outputTokens === null) {
    errors.push({
      field: 'outputTokens',
      message: 'Output tokens is required',
      value: data.outputTokens,
    })
  } else if (!Number.isInteger(data.outputTokens) || data.outputTokens < 0) {
    errors.push({
      field: 'outputTokens',
      message: 'Output tokens must be a non-negative integer',
      value: data.outputTokens,
    })
  }

  // Validate cost (required, must fit in Decimal(10,6))
  if (data.cost === undefined || data.cost === null) {
    errors.push({
      field: 'cost',
      message: 'Cost is required',
      value: data.cost,
    })
  } else if (typeof data.cost !== 'number' || isNaN(data.cost)) {
    errors.push({
      field: 'cost',
      message: 'Cost must be a valid number',
      value: data.cost,
    })
  } else if (data.cost < 0) {
    errors.push({
      field: 'cost',
      message: 'Cost must be non-negative',
      value: data.cost,
    })
  } else if (data.cost >= 10000) {
    errors.push({
      field: 'cost',
      message: 'Cost exceeds maximum value (9999.999999)',
      value: data.cost,
    })
  }

  // Validate dataType (optional, max 50 chars)
  if (data.dataType !== undefined && data.dataType !== null) {
    if (typeof data.dataType !== 'string') {
      errors.push({
        field: 'dataType',
        message: 'Data type must be a string',
        value: data.dataType,
      })
    } else if (data.dataType.length > 50) {
      errors.push({
        field: 'dataType',
        message: 'Data type exceeds 50 characters',
        value: data.dataType,
      })
    }
  }

  // Validate operationId (optional, max 100 chars)
  if (data.operationId !== undefined && data.operationId !== null) {
    if (typeof data.operationId !== 'string') {
      errors.push({
        field: 'operationId',
        message: 'Operation ID must be a string',
        value: data.operationId,
      })
    } else if (data.operationId.length > 100) {
      errors.push({
        field: 'operationId',
        message: 'Operation ID exceeds 100 characters',
        value: data.operationId,
      })
    }
  }

  // Validate endpoint (optional, max 100 chars)
  if (data.endpoint !== undefined && data.endpoint !== null) {
    if (typeof data.endpoint !== 'string') {
      errors.push({
        field: 'endpoint',
        message: 'Endpoint must be a string',
        value: data.endpoint,
      })
    } else if (data.endpoint.length > 100) {
      errors.push({
        field: 'endpoint',
        message: 'Endpoint exceeds 100 characters',
        value: data.endpoint,
      })
    }
  }

  // Validate duration (optional, non-negative integer)
  if (data.duration !== undefined && data.duration !== null) {
    if (!Number.isInteger(data.duration) || data.duration < 0) {
      errors.push({
        field: 'duration',
        message: 'Duration must be a non-negative integer',
        value: data.duration,
      })
    }
  }

  // Validate success (required, boolean)
  if (data.success === undefined || data.success === null) {
    errors.push({
      field: 'success',
      message: 'Success flag is required',
      value: data.success,
    })
  } else if (typeof data.success !== 'boolean') {
    errors.push({
      field: 'success',
      message: 'Success must be a boolean',
      value: data.success,
    })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function sanitizeAIUsageData(data: AIUsageData): AIUsageData {
  return {
    model: data.model?.substring(0, 50) || 'unknown',
    inputTokens: Math.max(0, Math.floor(data.inputTokens || 0)),
    outputTokens: Math.max(0, Math.floor(data.outputTokens || 0)),
    cost: Math.min(9999.999999, Math.max(0, data.cost || 0)),
    dataType: data.dataType?.substring(0, 50),
    operationId: data.operationId?.substring(0, 100),
    endpoint: data.endpoint?.substring(0, 100),
    duration: data.duration !== undefined ? Math.max(0, Math.floor(data.duration)) : undefined,
    success: Boolean(data.success),
  }
}
