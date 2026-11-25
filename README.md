# Forms engine on Fastify and Zod (proof of concept)

This repository shows the Defra forms engine as a [Fastify](https://fastify.dev) plugin in which every schema is a [Zod](https://zod.dev) schema and every type for validated data comes from that schema. It is a proof of concept for discussion, not a release, and the package is marked `private`.

The plugin is a library: a host application registers it alongside the session, CSRF and cookie plugins it depends on, as hosts do with the hapi plugin today. A devserver in `src/devserver/` is such a host and is used to develop the plugin in this repository. It is left out of the package.

## Why this exists

In the hapi engine, a schema and its TypeScript type are written separately and kept in step by hand. In `@defra/forms-model`, the component schema validates one loose object whose rules branch on `type`, while the `ComponentDef` type is a union of about thirty interfaces written elsewhere. `Joi.object<ComponentDef>()` is a cast, so nothing checks that the two agree.

**Before** (hapi + Joi): a schema, and a separate interface that has to match it.

```ts
// form-definition/index.ts
export const componentSchema = Joi.object<ComponentDef>().keys({
  type: Joi.string<ComponentType>().trim().required(),
  schema: Joi.object({
    regex: Joi.when('type', {
      is: Joi.string().valid(ComponentType.TextField, ComponentType.MultilineTextField),
      then: Joi.string().trim().optional().custom(regexCustomValidator),
      otherwise: Joi.string().allow('')
    })
    // ...
  }).unknown(true)
  // ...
}).unknown(true)

// components/types.ts
export interface TextFieldComponent extends FormFieldBase {
  type: ComponentType.TextField
  schema: { max?: number; min?: number; length?: number; regex?: string }
  // ...
}
```

**After** (Fastify + Zod): one schema per component type, and the type is inferred from it.

```ts
// src/schema/components.ts
export const textFieldSchema = field(ComponentType.TextField).extend({
  options: fieldOptions
    .extend({ autocomplete: z.string().optional(), condition, customValidationMessage })
    .default({}),
  schema: minMaxLength.extend({ regex: regexSchema }).default({})
})

export const componentDefSchema = z.discriminatedUnion('type', [textFieldSchema /* , ... */])

export type ComponentDef = z.infer<typeof componentDefSchema>
export type TextFieldComponent = ComponentDefByType<ComponentType.TextField>
```

Fastify takes the same Zod schemas for route params, query strings and bodies through `fastify-type-provider-zod`, so a handler reads typed values with no generics and no casts. ESLint forbids type assertions in `src/` to keep it that way.

## Run it

```sh
npm install
npm run dev
```

Then open <http://localhost:3009/example-form>. The example form is `src/devserver/forms/example-form.yaml`. Set `PORT` to use another port and `SESSION_SECRET` to keep sessions across restarts.

`npm run verify` runs the format check, lint (ESLint and `tsc`), tests, build and a dry-run pack.

## Use it in a host

```ts
import fastifyCookie from '@fastify/cookie'
import fastifyCsrf from '@fastify/csrf-protection'
import fastifySession from '@fastify/session'
import formsEngine from '@defra/forms-engine-plugin-fastify'
import Fastify from 'fastify'

const server = Fastify()

await server.register(fastifyCookie)
await server.register(fastifySession, { secret: process.env.SESSION_SECRET })
await server.register(fastifyCsrf, { sessionPlugin: '@fastify/session' })

await server.register(formsEngine, {
  baseUrl: 'https://example.gov.uk',
  nunjucks: { baseLayoutPath: 'layout.html', paths: ['./views'] },
  services: {
    formsService: { getFormDefinition: (slug) => loadDefinitionFromSomewhere(slug) },
    outputService: { submit: (submission) => sendItSomewhere(submission) }
  }
})
```

The host needs no Zod set-up. The plugin sets the Zod compilers inside its own scope, so the host's other routes keep whatever validation they use. If a required plugin is missing or an option is wrong, Fastify stops at start-up with a clear error.

## Showcase

These files show where schema and type are one thing. Open them in an editor with TypeScript support.

| File                                                                                                                                | What to look at                                                                                                                                                       | Try in your IDE                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [src/schema/components.ts](src/schema/components.ts#L471)                                                                           | `componentDefSchema` is a discriminated union with one member per component type; `ComponentDef` is inferred at [line 505](src/schema/components.ts#L505).            | Hover `ComponentDef` to see every member. In a `switch (def.type)`, `def.options` narrows to that type's options.                                |
| [src/plugin/components/date-parts-field.ts](src/plugin/components/date-parts-field.ts#L38)                                          | `DatePartsField extends FieldBase<DatePartsFieldComponent>`: the class receives its own member of the union. Its `answerSchema()` is built when the form loads.       | Type `this.def.options.` and see only date options (`maxDaysInPast`, `earliestDate`, ...).                                                       |
| [src/plugin/options.ts](src/plugin/options.ts#L38)                                                                                  | Plugin options are a Zod schema and `PluginOptions` is `z.input` of it. Descriptions come from `.describe()`.                                                         | In [src/devserver/create-server.ts](src/devserver/create-server.ts#L60), type inside the `services` object to get autocomplete and descriptions. |
| [src/plugin/routes.ts](src/plugin/routes.ts#L45)                                                                                    | `pageBody` declares the engine's own keys and lets every other key be an answer (`string \| string[]`).                                                               | Hover `body.action` in the POST handler: it is `'validate' \| 'continue' \| 'send'`, with no generics or casts.                                  |
| [src/types/fastify.ts](src/types/fastify.ts#L11)                                                                                    | Session data is typed by declaration merging and shipped with the package.                                                                                            | `request.session.get('forms')` is typed in [src/plugin/session.ts](src/plugin/session.ts).                                                       |
| [src/schema/form-definition.ts](src/schema/form-definition.ts#L95)                                                                  | Cross-reference checks (condition, list, list item and component ids) live in the schema as one root refinement, each with a path and an error code.                  | Break a `condition` id in the example YAML and load the page: the log shows the issue path.                                                      |
| [src/schema/components.test-d.ts](src/schema/components.test-d.ts) and [src/plugin/options.test-d.ts](src/plugin/options.test-d.ts) | Type tests prove the narrowing and the required options.                                                                                                              | Delete an `@ts-expect-error` and run `npm test` to watch the type check fail.                                                                    |
| [src/plugin/models/form-model.ts](src/plugin/models/form-model.ts#L94)                                                              | `getFormContext` is the hapi engine's page walk, ported with its names; only Joi became Zod (`makeFilteredSchema` at [line 84](src/plugin/models/form-model.ts#L84)). | Compare with `getFormContext` in the hapi engine's `models/FormModel.ts`.                                                                        |

Answers are typed in general terms (`FormState = Record<string, FormValue>`), because the engine loads a form definition at runtime and cannot know its field names when it is compiled. Zod still checks each answer against rules built from the definition.

## From hapi to Fastify

| hapi                           | Fastify                                  |
| ------------------------------ | ---------------------------------------- |
| `server.register(plugin)`      | `fastify.register(plugin)`               |
| `server.expose` / `server.app` | `fastify.decorate`, or plain arguments   |
| plugin `dependencies`          | `fastify-plugin` `dependencies`          |
| route `options.pre`            | `preHandler` / `preValidation` hooks     |
| `@hapi/crumb`                  | `@fastify/csrf-protection`               |
| `@hapi/yar`                    | `@fastify/session`                       |
| `@hapi/vision`                 | `@fastify/view`                          |
| Joi `validate` on routes       | Zod schema + `fastify-type-provider-zod` |
| `h.redirect().code(303)`       | `reply.code(303).redirect()`             |

## What it does not cover

The slice renders TextField, NumberField, EmailAddressField, RadiosField, CheckboxesField and DatePartsField on question pages, a summary page and a confirmation page, with page conditions. The full V2 form definition schema is ported, including component types the engine does not render.

The following are not covered: repeaters, file upload, payment, maps and geospatial fields, postcode lookup, UK address, save and exit, i18n and Welsh, preview routes, page events, custom controllers, prefill from the query string, Redis and the client-side JavaScript bundle. Conditions support `is` and `is not` for string, boolean and list values, and `is more than` and `is less than` for numbers. Other operators throw a clear error.

Known costs:

- Each host would have to move to Fastify, as a Fastify plugin cannot be mounted in a hapi host.
- Zod 4 has no function schema, so the function options (`getFormDefinition`, `submit`, `viewContext`) are `z.custom` with a signature written by hand next to the schema. These are the only hand-written types beside a schema.
- Component `options` and `schema` declare every key each type accepts, and unknown keys are stripped. A definition that carries an undeclared key loses it without a warning, where the Joi schema let it through.
- Conditions are evaluated by a small function in `src/plugin/conditions/` rather than the `@defra/forms-model` expression parser, to avoid a dependency that brings Joi with it.

## Licence

The schema rules, enums, error codes and descriptions in `src/schema/` are derived from [`@defra/forms-model`](https://github.com/DEFRA/forms-model), and the page walk in `src/plugin/models/` and `src/plugin/page-controllers/` from [`@defra/forms-engine-plugin`](https://github.com/DEFRA/forms-engine-plugin). Both are © Crown copyright (Defra) under the [Open Government Licence v3.0](LICENCE), which also covers this repository.
