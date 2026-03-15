export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface DocumentBase {
  id?: string;
  number?: string;
  internalCode?: string;
  variableSymbol?: string;
  issueDate?: string;
  dueDate?: string;
  totalAmount?: number;
  currency?: string;
  partnerName?: string;
  partnerIC?: string;
  tag?: string;
  description?: string;
  flowStatus?: FlowStatus;
}

export interface DocumentBaseCollection {
  page?: number;
  pageSize?: number;
  totalPages?: number;
  totalItems?: number;
  items?: DocumentBase[];
}

export interface Document extends DocumentBase {
  serie?: Serie;
  vatDocumentCode?: string;
  constantSymbol?: string;
  specificSymbol?: string;
  vatDate?: string;
  acceptDate?: string;
  caseDate?: string;
  validFrom?: string;
  validTo?: string;
  taxExclusiveAmount?: number;
  roundingAmount?: number;
  totalAmountFC?: number;
  advanceAmount?: number;
  partnerVAT?: string;
  partnerLocalVAT?: string;
  partnerAddress?: string;
  partnerEmail?: string;
  accountNo?: string;
  bankCode?: string;
  iban?: string;
  bic?: string;
  exchangeRate?: number;
  orderNo?: string;
  contactPersonName?: string;
  lines?: DocumentLine[];
  vats?: DocumentVAT[];
  type?: DocumentTypeBase;
  partner?: PartnerBase;
  files?: DocumentFile[];
}

export interface DocumentLine {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  vatRate?: number;
  unit?: string;
}

export interface DocumentVAT {
  vatRate?: number;
  taxExclusiveAmount?: number;
  vatAmount?: number;
  taxInclusiveAmount?: number;
}

export interface DocumentFile {
  id?: string;
  name?: string;
  contentType?: string;
  created?: string;
}

export interface DocumentEvent {
  eventType?: string;
  created?: string;
  user?: UserBase;
  description?: string;
}

export interface Serie {
  id?: string;
  code?: string;
  description?: string;
}

export interface FlowStatus {
  name?: string;
  color?: string;
}

export interface DocumentTypeBase {
  id?: string;
  name?: string;
}

export interface PartnerBase {
  id?: string;
  name?: string;
  ic?: string;
  vat?: string;
}

export interface StorageFile {
  id: string;
  name?: string;
  description?: string;
  created?: string;
  updated?: string;
  removed?: string;
  locked: boolean;
  approvalStatus?: ApprovalStatus;
  folder?: StorageFolder;
  size?: number;
  contentType?: string;
}

export interface StorageFileCollection {
  page?: number;
  pageSize?: number;
  totalPages?: number;
  totalItems?: number;
  items?: StorageFile[];
}

export interface StorageFolder {
  id?: string;
  parentId?: string;
  name?: string;
  fullPath?: string;
  hasChildren?: boolean;
}

export interface ApprovalStatus {
  name?: string;
}

export interface ApprovalProcess {
  status?: string;
  items?: ApprovalProcessItem[];
}

export interface ApprovalProcessItem {
  order?: number;
  status?: string;
  users?: UserBase[];
}

export interface ApprovalsTemplate {
  id: string;
  name?: string;
  isEmpty: boolean;
}

export interface Comment {
  id?: string;
  text?: string;
  created?: string;
  user?: UserBase;
}

export interface Register {
  id?: string;
  externalId?: string;
  code?: string;
  description?: string;
  isValid?: boolean;
}

export interface PropertyDefinition {
  id?: string;
  name?: string;
  order?: number;
  show?: boolean;
  type?: string;
  editable?: boolean;
}

export interface Property {
  id?: string;
  definitionId?: string;
  name?: string;
  value?: string;
}

export interface OrganizationEntity {
  id: string;
  name?: string;
  created?: string;
  organizationUrlPart?: string;
  vatCountry?: string;
  vatNonPayer?: boolean;
}

export interface UserBase {
  id: string;
  identity?: Identity;
}

export interface Identity {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface UserFull extends UserBase {
  created?: string;
  hasFullAccess?: boolean;
}

export interface Role {
  id: string;
  name?: string;
  description?: string;
  users?: UserBase[];
  rights?: Right[];
}

export interface Right {
  id?: string;
  name?: string;
}

export interface Team {
  id: string;
  name?: string;
  description?: string;
  system?: boolean;
  users?: UserBase[];
}

export interface WebHookRegistration {
  id?: string;
  webHookUri?: string;
  description?: string;
  actions?: WebHookAction[];
}

export interface WebHookAction {
  action?: string;
}

export interface DocumentType {
  id?: string;
  name?: string;
  kind?: string;
  invoiceType?: string;
}

