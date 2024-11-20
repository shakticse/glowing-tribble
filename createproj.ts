import fs from 'fs-extra';
import path from 'path';
import { Project, QuoteKind, ts } from 'ts-morph';
import { execSync } from 'child_process';
import inquirer from 'inquirer';


// OpenAPI Specification Interface
interface OpenAPISpecification {
    projectName: string;
    components: {
      name: string;
      fields: {
        name: string;
        type: string;
        required?: boolean;
        regex?: string;
        options?: string[];
        validationMessage?: string;
      }[];
      menuName?: string;
    }[];
    menuType: 'horizontal' | 'vertical';
    footerContent?: string;
  }


async function generateAngularProjectWithTSMorph(
    spec: OpenAPISpecification,
    useBootstrap: boolean,
    columnLayout: number
  ): Promise<void> {
    const project = new Project({
      manipulationSettings: {
        quoteKind: QuoteKind.Single,
      },
    });
  
    const { projectName, components, menuType, footerContent } = spec;
  
    // Create Angular Project Skeleton
    console.log('Creating Angular project skeleton...');
    fs.emptyDirSync(projectName);
    fs.ensureDirSync(`${projectName}/src/app`);
  
    // Generate App Module and Routing Module
    const appModuleFile = project.createSourceFile(
      `${projectName}/src/app/app.module.ts`,
      '',
      { overwrite: true }
    );
    const appRoutingModuleFile = project.createSourceFile(
      `${projectName}/src/app/app-routing.module.ts`,
      generateAppRoutingModuleContent(components),
      { overwrite: true }
    );
  
    // Generate Components
    components.forEach((component) => {
      const componentDir = `${projectName}/src/app/${component.name.toLowerCase()}`;
      fs.ensureDirSync(componentDir);
  
      // Create Component Files
      project.createSourceFile(
        `${componentDir}/${component.name.toLowerCase()}.component.ts`,
        generateComponentTSContent(component),
        { overwrite: true }
      );
  
      const componentHtmlContent = generateComponentHTMLContent(
        component,
        useBootstrap,
        columnLayout
      );
  
      fs.writeFileSync(
        `${componentDir}/${component.name.toLowerCase()}.component.html`,
        componentHtmlContent
      );
  
      fs.writeFileSync(`${componentDir}/${component.name.toLowerCase()}.component.css`, '');
    });
  
    // Generate App Component
    const menuHtml = generateMenuHTMLContent(components, menuType, useBootstrap);
    const footerHtml = footerContent ? `<footer>${footerContent}</footer>` : '';
    fs.writeFileSync(
      `${projectName}/src/app/app.component.html`,
      `
        ${menuHtml}
        <router-outlet></router-outlet>
        ${footerHtml}
      `
    );
  
    // Save Files
    project.saveSync();
    console.log(`Angular project "${projectName}" generated successfully.`);
  }
  
  function generateAppRoutingModuleContent(components: any[]): string {
    const imports = components
      .map(
        (component) =>
          `import { ${component.name}Component } from './${component.name.toLowerCase()}/${component.name.toLowerCase()}.component';`
      )
      .join('\n');
  
    const routes = components
      .map(
        (component) =>
          `{ path: '${component.name.toLowerCase()}', component: ${component.name}Component }`
      )
      .join(',\n');
  
    return `
      import { NgModule } from '@angular/core';
      import { RouterModule, Routes } from '@angular/router';
  
      ${imports}
  
      const routes: Routes = [
        ${routes},
        { path: '', redirectTo: '/${components[0].name.toLowerCase()}', pathMatch: 'full' },
        { path: '**', redirectTo: '/${components[0].name.toLowerCase()}' }
      ];
  
      @NgModule({
        imports: [RouterModule.forRoot(routes)],
        exports: [RouterModule]
      })
      export class AppRoutingModule { }
    `;
  }
  
  function generateComponentTSContent(component: any): string {
    return `
      import { Component, OnInit } from '@angular/core';
  
      @Component({
        selector: 'app-${component.name.toLowerCase()}',
        templateUrl: './${component.name.toLowerCase()}.component.html',
        styleUrls: ['./${component.name.toLowerCase()}.component.css']
      })
      export class ${component.name}Component implements OnInit {
        constructor() { }
  
        ngOnInit(): void { }
  
        onSubmit(form: any): void {
          if (form.valid) {
            console.log('Form submitted:', form.value);
          } else {
            console.log('Form validation failed.');
          }
        }
      }
    `;
  }
  
  function generateComponentHTMLContent(
    component: any,
    useBootstrap: boolean,
    columnLayout: number
  ): string {
    const fieldHTML = component.fields
      .map((field: any) => {
        const { name, type, required, regex, options = [], validationMessage } = field;
  
        const label = toTitleCase(name); // Format label
        const requiredMarker = required ? ' *' : '';
        const defaultValidationMessage = `${label} is required`;
        const errorMessage = validationMessage || defaultValidationMessage;
  
        let controlHTML = '';
  
        switch (type) {
            case 'textbox':
              controlHTML = `
                <label for="${name}">${label}${requiredMarker}</label>
                <input type="text" id="${name}" name="${name}" class="form-control" [ngModel]="${name}" ${required ? 'required' : ''} ${regex ? `pattern="${regex}"` : ''}/>
                <div *ngIf="form.${name}.errors?.required" class="text-danger">${errorMessage}</div>
              ${
                regex
                  ? `<div *ngIf="form.${name}.errors?.pattern" class="text-danger">${validationMessage || `${name} format is invalid`}</div>`
                  : ''
              }
              `;
              break;
    
            case 'textarea':
              controlHTML = `
                <label for="${name}">${label}${requiredMarker}</label>
                <textarea id="${name}" name="${name}" class="form-control" [ngModel]="${name}" ${required ? 'required' : ''}></textarea>
                <div *ngIf="form.${name}.errors?.required" class="text-danger">${errorMessage}</div>
              `;
              break;
    
            case 'dropdown':
              controlHTML = `
                <label for="${name}">${label}${requiredMarker}</label>
                <select id="${name}" name="${name}" class="form-control" [ngModel]="${name}" ${required ? 'required' : ''}>
                  <option value="">-- Select --</option>
                  ${options.map((option: string) => `<option value="${option}">${option}</option>`).join('')}
                </select>
                <div *ngIf="form.${name}.errors?.required" class="text-danger">${errorMessage}</div>
              `;
              break;
    
            case 'checkbox':
              controlHTML = `
                <label>
                  <input type="checkbox" id="${name}" name="${name}" [ngModel]="${name}" /> ${label}
                </label>
              `;
              break;
    
            case 'checkboxlist':
              controlHTML = `
                <label>${label}${requiredMarker}</label>
                <div>
                  ${options
                    .map(
                      (option: string) =>
                        `<label><input type="checkbox" name="${name}" value="${option}" [ngModel]="${name}"/> ${option}</label>`
                    )
                    .join('<br>')}
                </div>
              `;
              break;
    
            case 'radiobutton':
              controlHTML = `
                <label>
                  <input type="radio" id="${name}" name="${name}" [ngModel]="${name}" /> ${label}
                </label>
              `;
              break;
    
            case 'radiobuttonlist':
              controlHTML = `
                <label>${label}${requiredMarker}</label>
                <div>
                  ${options
                    .map(
                      (option: string) =>
                        `<label><input type="radio" name="${name}" value="${option}" [ngModel]="${name}" /> ${option}</label>`
                    )
                    .join('<br>')}
                </div>
                <div *ngIf="form.${name}.errors?.required" class="text-danger">${errorMessage}</div>
              `;
              break;
    
            default:
              controlHTML = `
                <label for="${name}">${label}${requiredMarker}</label>
                <input type="text" id="${name}" name="${name}" class="form-control" [ngModel]="${name}" ${required ? 'required' : ''} ${regex ? `pattern="${regex}"` : ''}/>
                <div *ngIf="form.${name}.errors?.required" class="text-danger">${errorMessage}</div>
              ${
                regex
                  ? `<div *ngIf="form.${name}.errors?.pattern" class="text-danger">${validationMessage || `${name} format is invalid`}</div>`
                  : ''
              }
              `;
              break;
            }
  
        return `<div class="form-group">${controlHTML}</div>`;
      })
      .join('');
  
    const layoutClass = useBootstrap
      ? `row row-cols-${columnLayout}`
      : 'custom-layout';
  
    return `
      <form #form="ngForm" (ngSubmit)="onSubmit(form)" class="${layoutClass}">
        ${fieldHTML}
        <button type="submit" class="btn btn-primary">Submit</button>
      </form>
    `;
  }
  
  function generateMenuHTMLContent(
    components: any[],
    menuType: string,
    useBootstrap: boolean
  ): string {
    const menuClass = useBootstrap
      ? menuType === 'vertical'
        ? 'nav flex-column'
        : 'nav nav-pills'
      : menuType === 'vertical'
      ? 'custom-vertical-menu'
      : 'custom-horizontal-menu';
  
    const menuItems = components
      .map(
        (component) =>
          `<a class="nav-link" routerLink="/${component.name.toLowerCase()}">${component.menuName || component.name}</a>`
      )
      .join('');
  
    return `<nav class="${menuClass}">${menuItems}</nav>`;
  }
  
  
  // Main
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
  };

  main().catch(console.error);

function generateAngularProjectWithRouting(
    openApiSpec: any
): void {
    const { projectName, components, menuType, footerContent } = openApiSpec;
    
    // Generate Angular project skeleton
    console.log(`Generating Angular project: ${projectName}`);
    execSync(`ng new ${projectName} --routing --style css`, { stdio: 'inherit' });
  
    // Generate dynamic menu
    const menuHtml = generateMenuHTML(components, menuType);
  
    // Process components
    components.forEach((component) => {
        console.log(`Generating component: ${component.name}`);
      const htmlContent = generateComponentHTML(component);
      const tsContent = generateComponentTS(component);
      const componentDir = `./${projectName}/src/app/${component.name.toLowerCase()}`;
      fs.ensureDirSync(componentDir);
      fs.writeFileSync(`${componentDir}/${component.name.toLowerCase()}.component.html`, htmlContent);
      fs.writeFileSync(`${componentDir}/${component.name.toLowerCase()}.component.ts`, tsContent);
      fs.writeFileSync(`${componentDir}/${component.name.toLowerCase()}.component.css`, '');
    });
  
    // Add routing
    const routingContent = generateAppRoutingModule(components);
    fs.writeFileSync(`./${projectName}/src/app/app-routing.module.ts`, routingContent);
  
    // Add menu and footer to AppComponent
    const footerHtml = footerContent ? `<footer>${footerContent}</footer>` : '';
    const appComponentHtml = `
      ${menuHtml}
      <router-outlet></router-outlet>
      ${footerHtml}
    `;
    fs.writeFileSync(`./${projectName}/src/app/app.component.html`, appComponentHtml);
  
    console.log(`Angular project ${projectName} generated successfully.`);
  }

  function generateMenuHTML(components: any[], menuType: string): string {
    // Define dynamic styles for menu
    const dynamicStyles =
      menuType === 'vertical'
        ? `
          display: flex;
          flex-direction: column;
          gap: 10px;
        `
        : `
          display: flex;
          flex-direction: row;
          gap: 20px;
        `;
  
    const menuItems = components
      .map(
        (component) =>
          `<a routerLink="/${component.name.toLowerCase()}" style="text-decoration: none; color: inherit;">
            ${component.menuName || component.name}
          </a>`
      )
      .join('');
  
    return `
      <nav style="${dynamicStyles}">
        ${menuItems}
      </nav>
    `;
  }

  function generateComponentHTML(component: any): string {
    const fields = component.fields;
  
    let formFieldsHTML = fields
      .map((field: any) => {
        const { name, type, required, regex, options = [], validationMessage } = field;
  
        const label = toTitleCase(name); // Format label
        const requiredMarker = required ? ' *' : '';
        const defaultValidationMessage = `${name} is required`;
        const errorMessage = validationMessage || defaultValidationMessage;
  
        let controlHTML = '';
        
        switch (type) {
            case 'textbox':
              controlHTML = `
                <label for="${name}">${label}${requiredMarker}</label>
                <input type="text" id="${name}" name="${name}" class="form-control" [ngModel]="${name}" ${required ? 'required' : ''} ${regex ? `pattern="${regex}"` : ''}/>
                <div *ngIf="form.${name}.errors?.required" class="text-danger">${errorMessage}</div>
              ${
                regex
                  ? `<div *ngIf="form.${name}.errors?.pattern" class="text-danger">${validationMessage || `${name} format is invalid`}</div>`
                  : ''
              }
              `;
              break;
    
            case 'textarea':
              controlHTML = `
                <label for="${name}">${label}${requiredMarker}</label>
                <textarea id="${name}" name="${name}" class="form-control" [ngModel]="${name}" ${required ? 'required' : ''}></textarea>
                <div *ngIf="form.${name}.errors?.required" class="text-danger">${errorMessage}</div>
              `;
              break;
    
            case 'dropdown':
              controlHTML = `
                <label for="${name}">${label}${requiredMarker}</label>
                <select id="${name}" name="${name}" class="form-control" [ngModel]="${name}" ${required ? 'required' : ''}>
                  <option value="">-- Select --</option>
                  ${options.map((option: string) => `<option value="${option}">${option}</option>`).join('')}
                </select>
                <div *ngIf="form.${name}.errors?.required" class="text-danger">${errorMessage}</div>
              `;
              break;
    
            case 'checkbox':
              controlHTML = `
                <label>
                  <input type="checkbox" id="${name}" name="${name}" [ngModel]="${name}" /> ${label}
                </label>
              `;
              break;
    
            case 'checkboxlist':
              controlHTML = `
                <label>${label}${requiredMarker}</label>
                <div>
                  ${options
                    .map(
                      (option: string) =>
                        `<label><input type="checkbox" name="${name}" value="${option}" [ngModel]="${name}"/> ${option}</label>`
                    )
                    .join('<br>')}
                </div>
              `;
              break;
    
            case 'radiobutton':
              controlHTML = `
                <label>
                  <input type="radio" id="${name}" name="${name}" [ngModel]="${name}" /> ${label}
                </label>
              `;
              break;
    
            case 'radiobuttonlist':
              controlHTML = `
                <label>${label}${requiredMarker}</label>
                <div>
                  ${options
                    .map(
                      (option: string) =>
                        `<label><input type="radio" name="${name}" value="${option}" [ngModel]="${name}" /> ${option}</label>`
                    )
                    .join('<br>')}
                </div>
                <div *ngIf="form.${name}.errors?.required" class="text-danger">${errorMessage}</div>
              `;
              break;
    
            default:
              controlHTML = `
                <label for="${name}">${label}${requiredMarker}</label>
                <input type="text" id="${name}" name="${name}" class="form-control" [ngModel]="${name}" ${required ? 'required' : ''} ${regex ? `pattern="${regex}"` : ''}/>
                <div *ngIf="form.${name}.errors?.required" class="text-danger">${errorMessage}</div>
              ${
                regex
                  ? `<div *ngIf="form.${name}.errors?.pattern" class="text-danger">${validationMessage || `${name} format is invalid`}</div>`
                  : ''
              }
              `;
              break;
        }
    
        // switch (type) {
        //   case 'textbox':
        //     controlHTML = `
        //       <label for="${name}">${name}${requiredMarker}</label>
        //       <input 
        //         type="text" 
        //         id="${name}" 
        //         name="${name}" 
        //         class="form-control" 
        //         [ngModel]="${name}" 
        //         ${required ? 'required' : ''} 
        //         ${regex ? `pattern="${regex}"` : ''}
        //       />
        //       <div *ngIf="form.${name}.errors?.required" class="text-danger">${errorMessage}</div>
        //       ${
        //         regex
        //           ? `<div *ngIf="form.${name}.errors?.pattern" class="text-danger">${validationMessage || `${name} format is invalid`}</div>`
        //           : ''
        //       }
        //     `;
        //     break;
  
        //   case 'dropdown':
        //     controlHTML = `
        //       <label for="${name}">${name}${requiredMarker}</label>
        //       <select 
        //         id="${name}" 
        //         name="${name}" 
        //         class="form-control" 
        //         [ngModel]="${name}" 
        //         ${required ? 'required' : ''}
        //       >
        //         <option value="">-- Select --</option>
        //         ${options.map((option: string) => `<option value="${option}">${option}</option>`).join('')}
        //       </select>
        //       <div *ngIf="form.${name}.errors?.required" class="text-danger">${errorMessage}</div>
        //     `;
        //     break;
  
        //   default:
        //     controlHTML = `
        //       <label for="${name}">${name}${requiredMarker}</label>
        //       <input 
        //         type="text" 
        //         id="${name}" 
        //         name="${name}" 
        //         class="form-control" 
        //         [ngModel]="${name}" 
        //         ${required ? 'required' : ''} 
        //         ${regex ? `pattern="${regex}"` : ''}
        //       />
        //       <div *ngIf="form.${name}.errors?.required" class="text-danger">${errorMessage}</div>
        //       ${
        //         regex
        //           ? `<div *ngIf="form.${name}.errors?.pattern" class="text-danger">${validationMessage || `${name} format is invalid`}</div>`
        //           : ''
        //       }
        //     `;
        //     break;
        // }
  
        return `
          <div class="form-group">
            ${controlHTML}
          </div>
        `;
      })
      .join('\n');
  
    return `
      <form #form="ngForm" (ngSubmit)="onSubmit(form)">
        ${formFieldsHTML}
        <button type="submit" class="btn btn-primary">Submit</button>
      </form>
    `;
  }

  function generateComponentTS(component: any): string {
    const className = `${component.name.charAt(0).toUpperCase() + component.name.slice(1)}Component`;
  
    return `
      import { Component, OnInit } from '@angular/core';
  
      @Component({
        selector: 'app-${component.name.toLowerCase()}',
        templateUrl: './${component.name.toLowerCase()}.component.html',
        styleUrls: ['./${component.name.toLowerCase()}.component.css']
      })
      export class ${className} implements OnInit {
  
        constructor() { }
  
        ngOnInit(): void { }
  
        onSubmit(form: any): void {
          if (form.valid) {
            console.log('Form submitted successfully:', form.value);
          } else {
            console.log('Form validation failed');
          }
        }
      }
    `;
  }

  function generateAppRoutingModule(components: any[]): string {
    const routes = components
      .map((component) => `  { path: '${component.name.toLowerCase()}', component: ${component.name.charAt(0).toUpperCase() + component.name.slice(1)}Component }`)
      .join(',\n');
  
    return `
      import { NgModule } from '@angular/core';
      import { RouterModule, Routes } from '@angular/router';
  
      ${components
        .map(
          (component) =>
            `import { ${component.name.charAt(0).toUpperCase() + component.name.slice(1)}Component } from './${component.name.toLowerCase()}/${component.name.toLowerCase()}.component';`
        )
        .join('\n')}
  
      const routes: Routes = [
        ${routes},
        { path: '', redirectTo: '/${components[0].name.toLowerCase()}', pathMatch: 'full' },
        { path: '**', redirectTo: '/${components[0].name.toLowerCase()}' }
      ];
  
      @NgModule({
        imports: [RouterModule.forRoot(routes)],
        exports: [RouterModule]
      })
      export class AppRoutingModule { }
    `;
  }
  
  function toTitleCase(text: string): string {
    return text
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

//   // Example usage

//   async function main() {
//     const { filePath } = await inquirer.prompt([
//       {
//         type: 'input',
//         name: 'filePath',
//         message: 'Enter the path to the OpenAPI specification JSON file:',
//       },
//     ]);
  
//     const { useBootstrap } = await inquirer.prompt([
//       {
//         type: 'confirm',
//         name: 'useBootstrap',
//         message: 'Do you want to use Bootstrap for styling?',
//       },
//     ]);
  
//     const { columnLayout } = await inquirer.prompt([
//       {
//         type: 'list',
//         name: 'columnLayout',
//         message: 'Choose a column layout:',
//         choices: [
//           { name: '2 Columns', value: 2 },
//           { name: '3 Columns', value: 3 },
//           { name: '4 Columns', value: 4 },
//         ],
//       },
//     ]);
  
//     const spec = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as OpenAPISpecification;
  
//     //await generateAngularProjectWithTSMorph(spec, useBootstrap, columnLayout);
//     generateAngularProjectWithRouting(spec, useBootstrap, columnLayout);
//   }
  
//   main().catch(console.error);

