import fs from 'fs-extra';
import { execSync } from 'child_process';
import path from 'path';
import inquirer from 'inquirer';
import { Project, StructureKind } from 'ts-morph';

interface OpenAPIComponentField {
  name: string;
  type: string;
  validations?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    regex?: string;
    range?: [number, number];
    defaultValue?: string | number | boolean;
  };
}

interface OpenAPIComponent {
  name: string;
  fields: OpenAPIComponentField[];
  buttons: string[];
}

interface OpenAPISpecification {
  projectName: string;
  components: OpenAPIComponent[];
}

async function generateAngularProjectWithTSMorph(
  spec: OpenAPISpecification,
  useBootstrap: boolean,
  columnLayout: number
) {
  const projectPath = path.join(process.cwd(), spec.projectName);

  console.log('Creating Angular project...');
  execSync(`npx @angular/cli new ${spec.projectName} --defaults`, { stdio: 'inherit' });

  process.chdir(projectPath);

  if (useBootstrap) {
    console.log('Adding Bootstrap to the project...');
    execSync(`npm install bootstrap`, { stdio: 'inherit' });
    const angularJsonPath = path.join(projectPath, 'angular.json');
    const angularJson = fs.readJSONSync(angularJsonPath);
    angularJson.projects[spec.projectName].architect.build.options.styles.push('node_modules/bootstrap/dist/css/bootstrap.min.css');
    fs.writeJSONSync(angularJsonPath, angularJson, { spaces: 2 });
  }

  const tsMorphProject = new Project();

  for (const component of spec.components) {
    console.log(`Generating component: ${component.name}`);
    execSync(`ng generate component ${component.name}`, { stdio: 'inherit' });

    const componentPath = path.join(projectPath, 'src', 'app', component.name, `${component.name}.component.ts`);
    const componentHtmlPath = path.join(projectPath, 'src', 'app', component.name, `${component.name}.component.html`);

    // Generate the component TypeScript file
    const componentSourceFile = tsMorphProject.createSourceFile(componentPath, {}, { overwrite: true });

    componentSourceFile.addImportDeclarations([
      { namedImports: ['Component'], moduleSpecifier: '@angular/core' },
      { namedImports: ['FormBuilder', 'FormGroup', 'Validators'], moduleSpecifier: '@angular/forms' },
    ]);

    componentSourceFile.addClass({
      name: `${capitalize(component.name)}Component`,
      isExported: true,
      decorators: [
        {
          name: 'Component',
          arguments: [
            `{
              selector: 'app-${component.name}',
              templateUrl: './${component.name}.component.html',
              styleUrls: ['./${component.name}.component.css']
            }`,
          ],
        },
      ],
      properties: [
        {
          name: 'form',
          type: 'FormGroup',
        },
      ],
      ctors: [
        {
          parameters: [
            { name: 'fb', type: 'FormBuilder',},
          ],
          statements: [
            `this.form = this.fb.group({ ${generateValidationRules(component)} });`,
          ],
        },
      ],
      methods: [
        {
          name: 'onSubmit',
          statements: `
            if (this.form.valid) {
              console.log('Form Submitted:', this.form.value);
            } else {
              console.error('Form is invalid');
            }
          `,
        },
      ],
    });

    // Save the TypeScript file
    componentSourceFile.saveSync();

    // Generate HTML
    const htmlCode = generateComponentHTML(component, columnLayout, useBootstrap);
    fs.writeFileSync(componentHtmlPath, htmlCode);
  }

  console.log(`Angular project "${spec.projectName}" created successfully.`);
}

function generateValidationRules(component: OpenAPIComponent): string {
  return component.fields
    .map(field => {
      const validations:string[] = [];
      if (field.validations?.required) validations.push(`Validators.required`);
      if (field.validations?.minLength) validations.push(`Validators.minLength(${field.validations.minLength})`);
      if (field.validations?.maxLength) validations.push(`Validators.maxLength(${field.validations.maxLength})`);
      if (field.validations?.regex) validations.push(`Validators.pattern(/${field.validations.regex}/)`);
      if (field.validations?.range) validations.push(`Validators.min(${field.validations.range[0]}), Validators.max(${field.validations.range[1]})`);
      return `${field.name}: [null, [${validations.join(', ')}]]`;
    })
    .join(', ');
}

function generateComponentHTML(component: OpenAPIComponent, columnLayout: number, useBootstrap: boolean): string {
  const columnClass = useBootstrap ? `col-md-${12 / columnLayout}` : `custom-col-${columnLayout}`;
  const fieldsHtml = component.fields
    .map(field => {
      const label = `<label for="${field.name}">${capitalize(field.name)}</label>`;
      const input = `<input id="${field.name}" formControlName="${field.name}" type="text" class="form-control" />`;
      const error = `<div *ngIf="form.controls['${field.name}'].errors" class="text-danger">Invalid ${field.name}</div>`;
      return `<div class="${columnClass}">${label}\n${input}\n${error}</div>`;
    })
    .join('\n');

  const buttonsHtml = component.buttons
    .map(button => `<button type="button" class="btn btn-primary">${button}</button>`)
    .join('\n');

  return `
<div class="container">
  <form [formGroup]="form" (ngSubmit)="onSubmit()" class="row">
    ${fieldsHtml}
    <div class="w-100"></div>
    ${buttonsHtml}
  </form>
</div>
  `;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function main() {
  const { filePath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'filePath',
      message: 'Enter the path to the OpenAPI specification JSON file:',
    },
  ]);

  const { useBootstrap } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useBootstrap',
      message: 'Do you want to use Bootstrap for styling?',
    },
  ]);

  const { columnLayout } = await inquirer.prompt([
    {
      type: 'list',
      name: 'columnLayout',
      message: 'Choose a column layout:',
      choices: [
        { name: '2 Columns', value: 2 },
        { name: '3 Columns', value: 3 },
        { name: '4 Columns', value: 4 },
      ],
    },
  ]);

  const spec = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as OpenAPISpecification;

  await generateAngularProjectWithTSMorph(spec, useBootstrap, columnLayout);
}

main().catch(console.error);
