
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
  