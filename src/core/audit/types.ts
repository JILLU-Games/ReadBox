export type AuditDetails = Record<string, unknown>;

export type AuditJsonValue =
  | string
  | number
  | boolean
  | null
  | AuditJsonValue[]
  | { [key: string]: AuditJsonValue };

export interface AuditWriteClient {
  auditLog: {
    create(args: {
      data: {
        actorId: bigint | null;
        action: string;
        targetType: string;
        targetIdentifier: string;
        ipAddress: string | null;
        userAgent: string;
        details: { [key: string]: AuditJsonValue };
      };
    }): Promise<unknown>;
  };
}

export interface RecordAuditInput {
  readonly actorId?: bigint | string | null;
  readonly action: string;
  readonly targetType?: string;
  readonly targetIdentifier?: string;
  readonly headers?: Pick<Headers, "get">;
  readonly clientIp?: string | null;
  readonly userAgent?: string | null;
  readonly trustProxyHeaders?: boolean;
  readonly details?: AuditDetails;
}
