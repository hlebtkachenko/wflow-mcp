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
  type?: string;
  created?: string;
  identity?: Identity;
  info?: string;
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
  author?: Identity;
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
  login?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
}

export interface Collection<T> {
  page?: number;
  pageSize?: number;
  totalItems?: number;
  items?: T[];
}

export interface RoleBase {
  id: string;
  name?: string;
  description?: string;
}

export interface TeamBase extends RoleBase {
  system?: boolean;
}

export interface OrganizationDomain {
  name?: string;
  subdomain?: string;
  baseURL?: string;
}

export interface UserFull extends UserBase {
  created?: string;
  hasFullAccess?: boolean;
}

export interface WebHookRegistration {
  id?: string;
  webHookUri?: string;
  description?: string;
  actions?: string[];
}

export interface DocumentType {
  id?: string;
  name?: string;
  kind?: string;
  invoiceType?: string;
}

