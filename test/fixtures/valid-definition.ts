import {
  ComponentType,
  ConditionType,
  ControllerType,
  OperatorName,
  type FormDefinitionInput
} from '../../src/schema/index.js'

export const ids = {
  yesNoList: '5a1c3f4e-0d0a-4c8e-9b7b-1f0f2c3d4e01',
  yes: '5a1c3f4e-0d0a-4c8e-9b7b-1f0f2c3d4e02',
  no: '5a1c3f4e-0d0a-4c8e-9b7b-1f0f2c3d4e03',
  hasPet: '5a1c3f4e-0d0a-4c8e-9b7b-1f0f2c3d4e04',
  fullName: '5a1c3f4e-0d0a-4c8e-9b7b-1f0f2c3d4e05',
  hasPetYes: '5a1c3f4e-0d0a-4c8e-9b7b-1f0f2c3d4e06',
  hasPetYesItem: '5a1c3f4e-0d0a-4c8e-9b7b-1f0f2c3d4e07'
} as const

export const validDefinition = {
  schema: 2,
  engine: 'V2',
  name: 'Fixture form',
  sections: [],
  lists: [
    {
      id: ids.yesNoList,
      name: 'yesNo',
      title: 'Yes or no',
      type: 'string',
      items: [
        { id: ids.yes, text: 'Yes', value: 'yes' },
        { id: ids.no, text: 'No', value: 'no' }
      ]
    }
  ],
  conditions: [
    {
      id: ids.hasPetYes,
      displayName: 'Has a pet',
      items: [
        {
          id: ids.hasPetYesItem,
          componentId: ids.hasPet,
          operator: OperatorName.Is,
          type: ConditionType.ListItemRef,
          value: { listId: ids.yesNoList, itemId: [ids.yes] }
        }
      ]
    }
  ],
  pages: [
    {
      path: '/your-name',
      title: 'Your name',
      components: [
        {
          id: ids.fullName,
          type: ComponentType.TextField,
          name: 'fullName',
          title: 'What is your full name?'
        }
      ]
    },
    {
      path: '/has-pet',
      title: 'Pets',
      components: [
        {
          id: ids.hasPet,
          type: ComponentType.RadiosField,
          name: 'hasPet',
          title: 'Do you have a pet?',
          list: ids.yesNoList
        }
      ]
    },
    {
      path: '/pet-name',
      title: 'Pet name',
      condition: ids.hasPetYes,
      components: [
        {
          type: ComponentType.TextField,
          name: 'petName',
          title: 'What is your pet called?'
        }
      ]
    },
    {
      path: '/summary',
      title: 'Check your answers',
      controller: ControllerType.Summary
    }
  ]
} satisfies FormDefinitionInput
