# Forms engine on Fastify and Zod (draft proof of concept)

> [!WARNING]
> This is a **draft proof of concept**. It is not the production forms engine and must not be used to run live forms. A significant amount of the production engine's functionality is missing; see [What it does not cover](#what-it-does-not-cover). The production engine is [`@defra/forms-engine-plugin`](https://github.com/DEFRA/forms-engine-plugin).

This repository explores how the Defra forms engine could look as a [Fastify](https://fastify.dev) plugin in which every schema is a [Zod](https://zod.dev) schema and every type for validated data comes from that schema. It was built to support a discussion about tooling, covers only a thin slice of one journey, and has not been reviewed for production use. The package is marked `private` and is not published.

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
| [src/plugin/routes.ts](src/plugin/routes.ts#L45)                                                                                    | `pageBody` declares the engine's own keys and lets every other key be an answer (`string \| string[]`).                                                               | Hover `body.action` in the POST handler: it is `'validate' \| 'send'`, with no generics or casts.                                                |
| [src/types/fastify.ts](src/types/fastify.ts#L11)                                                                                    | Session data is typed by declaration merging and shipped with the package.                                                                                            | `request.session.get('forms')` is typed in [src/plugin/session.ts](src/plugin/session.ts).                                                       |
| [src/schema/form-definition.ts](src/schema/form-definition.ts#L95)                                                                  | Cross-reference checks (condition, list, list item and component ids) live in the schema as one root refinement, each with a path and an error code.                  | Break a `condition` id in the example YAML, restart the devserver and load the page: the log shows the issue path.                               |
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

This proof of concept is deliberately narrow, and much of what the production engine does is missing. It renders TextField, NumberField, EmailAddressField, RadiosField, CheckboxesField and DatePartsField on question pages, a summary page and a confirmation page, with page conditions. The full V2 form definition schema is ported, including component types the engine does not render.

### Left out of scope

- **Page types:** repeaters (add another, list summary, delete item), file upload pages, and terminal or exit pages.
- **Components the engine does not render:** multiline text, telephone number, yes/no, select, autocomplete, month and year, declaration, hidden and tracking fields; UK address with postcode lookup; easting and northing, OS grid reference, national grid and latitude and longitude fields; geospatial maps; payment through GOV.UK Pay. Content components (HTML, Markdown, details, inset text, list, notification banner) are dropped from pages without a warning.
- **Journey features:** save and exit, preview routes (`/preview/{state}/...`), page events (`onLoad` and `onSave` HTTP calls), custom controllers supplied by a host, and prefill from the query string.
- **Services:** form metadata (live and draft status, notification email), the submission API and notification emails, the form-unavailable page and reference number prefixes. The devserver only logs a submitted form.
- **Language:** i18n and Welsh. All text is English and written into the code.
- **Infrastructure:** Redis or catbox caching (sessions are held in memory), the client-side JavaScript bundle and the engine's own stylesheet (`shared.scss`). Pages use the plain GOV.UK Frontend CSS.
- **Schema:** the V1 form definition.

### Behaviour that differs from the production engine

- Conditions support only `is` and `is not` for string, boolean and list values, and `is more than` and `is less than` for numbers. Dates, relative dates, lengths, `contains` and other operators throw an error.
- The reference number is created when the form is sent rather than on the first request.
- Validation messages for the six components are written to match the production engine's English text rather than taken from its shared message set.
- Section titles, back links, flash messages, component-level conditions and conditional reveals inside list items are not ported.
- Some component options are parsed but not applied, for example NumberField precision, `maxWords`, and the date limits `maxDaysInPast`, `maxDaysInFuture`, `earliestDate` and `latestDate`.
- Component `options` and `schema` declare every key each type accepts, and unknown keys are stripped. A definition that carries an undeclared key loses it without a warning, where the Joi schema let it through.

### Known issues

- Page paths in the schema are not checked against the route pattern (`^[a-z0-9-]+$`), so such a page loads but cannot be opened.
- A summary page at a path other than `/summary` breaks the change links.
- A definition without a summary page, or with a component the engine does not render, gives a general server error rather than the "form definition is invalid" error.
- NumberField accepts hexadecimal input such as `0x20`.
- A page opened with `?force` lists errors from other pages in its error summary.
- The check for list answers that a changed answer no longer offers looks at every list field, where the production engine stops at the first and skips yes/no fields.
- `@fastify/static` is a runtime dependency although only the devserver uses it.

### Known costs of the approach

- Each host would have to move to Fastify, as a Fastify plugin cannot be mounted in a hapi host.
- Zod 4 has no function schema, so the function options (`getFormDefinition`, `submit`, `viewContext`) are `z.custom` with a signature written by hand next to the schema. These are the only hand-written types beside a schema.
- Conditions are evaluated by a small function in `src/plugin/conditions/` rather than the `@defra/forms-model` expression parser, to avoid a dependency that brings Joi with it.

## Licence

The schema rules, enums, error codes and descriptions in `src/schema/` are derived from [`@defra/forms-model`](https://github.com/DEFRA/forms-model), and the page walk in `src/plugin/models/` and `src/plugin/page-controllers/` from [`@defra/forms-engine-plugin`](https://github.com/DEFRA/forms-engine-plugin). Both are © Crown copyright (Defra) under the [Open Government Licence v3.0](LICENCE), which also covers this repository.
