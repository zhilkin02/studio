export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public readonly context: SecurityRuleContext;
  constructor(context: SecurityRuleContext) {
    const deniedMessage = `Firestore Security Rules denied the following request:
{
  "operation": "${context.operation}",
  "path": "${context.path}"${
      context.requestResourceData
        ? `,
  "request.resource.data": ${JSON.stringify(
    context.requestResourceData,
    null,
    2
  )}`
        : ''
    }
}
`;
    super(deniedMessage);
    this.name = 'FirestorePermissionError';
    this.context = context;
    Object.setPrototypeOf(this, FirestorePermissionError.prototype);
  }
}
