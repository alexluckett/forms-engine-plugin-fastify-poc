export enum ComponentType {
  TextField = 'TextField',
  MultilineTextField = 'MultilineTextField',
  YesNoField = 'YesNoField',
  DatePartsField = 'DatePartsField',
  MonthYearField = 'MonthYearField',
  SelectField = 'SelectField',
  AutocompleteField = 'AutocompleteField',
  RadiosField = 'RadiosField',
  CheckboxesField = 'CheckboxesField',
  NumberField = 'NumberField',
  UkAddressField = 'UkAddressField',
  TelephoneNumberField = 'TelephoneNumberField',
  EmailAddressField = 'EmailAddressField',
  Html = 'Html',
  InsetText = 'InsetText',
  Details = 'Details',
  List = 'List',
  Markdown = 'Markdown',
  NotificationBanner = 'NotificationBanner',
  FileUploadField = 'FileUploadField',
  DeclarationField = 'DeclarationField',
  EastingNorthingField = 'EastingNorthingField',
  OsGridRefField = 'OsGridRefField',
  NationalGridFieldNumberField = 'NationalGridFieldNumberField',
  LatLongField = 'LatLongField',
  HiddenField = 'HiddenField',
  TrackingField = 'TrackingField',
  PaymentField = 'PaymentField',
  GeospatialField = 'GeospatialField'
}

export enum GeospatialFieldOptionsCountryEnum {
  England = 'england',
  NorthernIreland = 'northern-ireland',
  Scotland = 'scotland',
  Wales = 'wales'
}

export enum GeospatialFieldGeometryTypesEnum {
  Point = 'point',
  Line = 'line',
  Shape = 'shape'
}

export enum TelephoneNumberFieldOptionsFormatEnum {
  UK = 'uk',
  International = 'international'
}

export enum ConditionType {
  Value = 'Value',
  RelativeDate = 'RelativeDate',
  StringValue = 'StringValue',
  BooleanValue = 'BooleanValue',
  NumberValue = 'NumberValue',
  DateValue = 'DateValue',
  ListItemRef = 'ListItemRef'
}

export enum Coordinator {
  AND = 'and',
  OR = 'or'
}

export enum OperatorName {
  Is = 'is',
  IsNot = 'is not',
  IsLongerThan = 'is longer than',
  IsShorterThan = 'is shorter than',
  HasLength = 'has length',
  Contains = 'contains',
  DoesNotContain = 'does not contain',
  IsAtLeast = 'is at least',
  IsAtMost = 'is at most',
  IsLessThan = 'is less than',
  IsMoreThan = 'is more than',
  IsBefore = 'is before',
  IsAfter = 'is after'
}

export enum ControllerType {
  Start = 'StartPageController',
  Page = 'PageController',
  Repeat = 'RepeatPageController',
  FileUpload = 'FileUploadPageController',
  Terminal = 'TerminalPageController',
  Summary = 'SummaryPageController',
  SummaryWithConfirmationEmail = 'SummaryPageWithConfirmationEmailController',
  Status = 'StatusPageController'
}
