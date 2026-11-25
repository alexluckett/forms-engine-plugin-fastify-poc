/**
 * Kinds of form definition error, attached to Zod issues as `params.errorType`
 * so that a form editor can group them.
 */
export enum FormDefinitionErrorType {
  Unique = 'unique',
  Ref = 'ref',
  Type = 'type',
  Incompatible = 'incompatible'
}

/**
 * Codes for form definition errors, attached to Zod issues as
 * `params.errorCode` so that a form editor can map each one to a message.
 */
export enum FormDefinitionError {
  UniquePageId = 'unique_page_id',
  UniquePagePath = 'unique_page_path',
  UniquePageComponentId = 'unique_page_component_id',
  UniquePageComponentName = 'unique_page_component_name',
  UniqueSectionId = 'unique_section_id',
  UniqueSectionName = 'unique_section_name',
  UniqueSectionTitle = 'unique_section_title',
  UniqueListId = 'unique_list_id',
  UniqueListTitle = 'unique_list_title',
  UniqueListName = 'unique_list_name',
  UniqueConditionId = 'unique_condition_id',
  UniqueConditionDisplayName = 'unique_condition_displayname',
  UniqueListItemId = 'unique_list_item_id',
  UniqueListItemText = 'unique_list_item_text',
  UniqueListItemValue = 'unique_list_item_value',
  UniqueOutput = 'unique_output',
  RefPageCondition = 'ref_page_condition',
  RefConditionComponentId = 'ref_condition_component_id',
  RefConditionListId = 'ref_condition_list_id',
  RefConditionItemId = 'ref_condition_item_id',
  RefConditionConditionId = 'ref_condition_condition_id',
  RefPageComponentList = 'ref_page_component_list',
  RefOutputCondition = 'ref_output_condition',
  IncompatibleConditionComponentType = 'incompatible_condition_component_type',
  IncompatibleQuestionRegex = 'incompatible_question_regex',
  Other = 'other'
}
