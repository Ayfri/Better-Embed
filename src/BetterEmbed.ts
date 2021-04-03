import {MessageEmbed, MessageEmbedOptions} from 'discord.js';

type AnyObject = {[k: string]: any};

type Template = MessageEmbedOptions;

type Templates = { [k in string | 'basic' | 'color' | 'complete' | 'image']: Template }

export const templates: Templates = {
	basic: {
		footer: {
			text: '${client.user.username}',
			iconURL: '${client.user.displayAvatarURL()}',
		},
		timestamp: new Date(),
	},
	color: {
		color: '#4b5afd',
	},
	get complete() {
		return {
			...this.basic,
			...this.color,
			title: '${title}',
			description: '${description}',
		};
	},
	get image() {
		return {
			...this.complete,
			image: {
				url: '${image}',
			},
		};
	},
};

export const limits = {
	author: {
		name: 256,
	},
	title: 256,
	description: 2048,
	footer: {
		text: 2048,
	},
	fields: {
		size: 25,
		name: 256,
		value: 1024,
	},
};

export class BetterEmbed extends MessageEmbed {
	public static LENGTH_LIMITS = limits;
	public static TEMPLATES = templates;
	
	public constructor(data?: MessageEmbed | Template) {
		super(data);
		this.checkSize();
	}
	
	public static fromTemplate(template: keyof Templates | Template, values: AnyObject): BetterEmbed {
		if (typeof template === 'string')
			if (templates[template]) template = templates[template];
			else throw new Error(`Template '${template}' not found.`);
		
		template = JSON.parse(JSON.stringify(template));
		
		function setValues(object: AnyObject, values: AnyObject): Template {
			for (const [name, value] of Object.entries(object)) {
				if (!object.hasOwnProperty(name)) continue;
				if (Array.isArray(value)) object[name] = value.map(v => setValues(v, values));
				if (typeof value === 'object') {
					object[name] = setValues(value, values);
					continue;
				}
				
				const code = value.replace(/\$\{([^}]+)\}/gu, (_: any, value: string) => (values.hasOwnProperty(value.split('.')[0])
				                                                                          ? `\${values.${value}}`
				                                                                          : value));
				object[name] = eval(`\`${code}\``);
			}
			
			return object;
		}
		
		return new BetterEmbed(setValues(template as AnyObject, values));
	}
	
	public checkSize(field: 'fields'): {index: number, limit: number} & ({name: boolean} | {value: boolean}) | boolean
	public checkSize(field: keyof Template): boolean;
	public checkSize(): {[k in keyof Template | string]: {content: string | Template[keyof Template], limit: number}}
	public checkSize(field?: keyof Template) {
		if (!field) {
			type key = keyof Template | string;
			type content = string | Template[keyof Template]
			const fields: {[k in key]: {content: content, limit: number}} = {};
			
			function addField(name: key, content: content, limit: number) {
				fields[name] = {
					content,
					limit,
				};
			}
			
			if (this.title && this.title.length > limits.title) addField('title', this.title, limits.title);
			if (this.author?.name && this.author.name.length > limits.author.name) addField('author', this.author.name, limits.author.name);
			if (this.description && this.description.length > limits.description) addField('description', this.description, limits.description);
			if (this.fields?.length > limits.fields.size) addField('fields', this.fields, limits.fields.size);
			this.fields.forEach((field, index) => {
				if (field.name?.length > limits.fields.name) addField(`field[${index}]`, field.name, limits.fields.name);
				if (field.value?.length > limits.fields.value) addField(`field[${index}]`, field.value, limits.fields.value);
			});
			
			return fields;
		}
		
		switch (field) {
			case 'fields':
				if (this.fields?.length) {
					return this.fields.length > limits.fields.size;
				} else {
					for (const field of this.fields) {
						const index = this.fields.indexOf(field);
						if (field.name.length > limits.fields.name) {
							return {
								index,
								name: true,
								limit: limits.fields.name
							}
						} else if (field.value.length > limits.fields.value) {
							return {
								index,
								value: true,
								limit: limits.fields.value
							}
						}
					}
					return false;
				}
			case 'footer':
				return this.footer?.text ? this.footer.text.length > limits.footer.text : true;
			case 'title':
				return this.title ? this.title?.length > limits.title : true;
			case 'author':
				return this.author?.name ? this.author.name.length > limits.author.name : true;
			case 'description':
				return this.description ? this.description.length > limits.description : true;
			default:
				return true;
		}
	}
	
	public throwIfTooLong() {
		if (this.title && this.title.length > limits.title) throw new RangeError(`'embed.title' is too long: ${this.title.length} (max: ${limits.title}).`);
		if (this.author?.name && this.author.name.length > limits.author.name) throw new RangeError(`'embed.author.name' is too long: ${this.author.name.length} (max: ${limits.author.name}).`);
		if (this.description && this.description.length > limits.description) throw new RangeError(`'embed.description' is too long: ${this.description.length} (max: ${limits.description}).`);
		if (this.fields?.length > limits.fields.size) throw new RangeError(`Too much fields (${limits.fields.size}).`);
		this.fields.forEach(field => {
			if (field.name?.length > limits.fields.name) throw new RangeError(`'embed.fields[${this.fields.indexOf(field)}].name' is too long: ${field.name.length} (max: ${limits.fields.name}).`);
			if (field.value?.length > limits.fields.value)
				throw new RangeError(`'embed.fields[${this.fields.indexOf(field)}].value' is too long: ${field.value.length} (max: ${limits.fields.value}).`);
		});
	}
	
	public cutIfTooLong() {
		function cutWithLength(text: string, maxLength: number) {
			return text.length > maxLength ? `${text.substring(0, maxLength - 3)}...` : text;
		}
		
		if (this.author?.name) this.author.name = cutWithLength(this.author.name, limits.author.name);
		if (this.description) this.description = cutWithLength(this.description, limits.description);
		if (this.title) this.title = cutWithLength(this.title, limits.title);
		if (this.fields) {
			if (this.fields.length > limits.fields.size) this.fields = this.fields.slice(0, limits.fields.size) ?? [];
			this.fields.forEach(field => {
				field.name = cutWithLength(field.name ?? '', limits.fields.name);
				field.value = cutWithLength(field.value ?? '', limits.fields.value);
			});
		}
	}
}
