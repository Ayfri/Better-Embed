import {MessageEmbed, MessageEmbedOptions} from 'discord.js';

type AnyObject = {[k: string]: any};

const templates: {[k: string]: MessageEmbedOptions} = {
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

const limits = {
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

class BetterEmbed extends MessageEmbed {
	public constructor(data?: MessageEmbed | MessageEmbedOptions) {
		super(data);
		this.checkSize();
	}

	static fromTemplate(template: keyof typeof templates | typeof templates | MessageEmbedOptions, values: AnyObject) {
		if (typeof template === 'string')
			if (templates[template]) template = templates[template];
			else throw new Error(`Template '${template}' not found.`);

		template = JSON.parse(JSON.stringify(template));

		function setValues(object: AnyObject, values: AnyObject): MessageEmbedOptions {
			for (const [name, value] of Object.entries(object)) {
				if (!object.hasOwnProperty(name)) continue;
				if (Array.isArray(value)) object[name] = value.map(v => setValues(v, values));
				if (typeof value === 'object') {
					object[name] = setValues(value, values);
					continue;
				}

				const code = value.replace(/\$\{([^}]+)\}/gu, (_: any, value: string) => (values.hasOwnProperty(value.split('.')[0]) ? `\${values.${value}}` : value));
				object[name] = eval(`\`${code}\``);
			}

			return object;
		}

		return new BetterEmbed(setValues(template as AnyObject, values));
	}

	checkSize() {
		if (this.title && this.title.length > limits.title) throw new RangeError(`embed.title is too long (${limits.title}).`);
		if (this.author?.name && this.author.name.length > limits.author.name) throw new RangeError(`embed.author.name is too long (${limits.author.name}).`);
		if (this.description && this.description.length > limits.description) throw new RangeError(`embed.description is too long (${limits.description}).`);
		if (this.title && this.title.length > limits.title) throw new RangeError(`embed.title is too long (${limits.title}).`);
		if (this.fields?.length > limits.fields.size) throw new RangeError(`Too much fields is too long (${limits.fields.size}).`);
		this.fields.forEach(field => {
			if (field.name?.length > limits.fields.name) throw new RangeError(`embed.fields[${this.fields.indexOf(field)}].name is too long (${limits.fields.name}).`);
			if (field.value?.length > limits.fields.value) throw new RangeError(`embed.fields[${this.fields.indexOf(field)}].value is too long (${limits.fields.value}).`);
		});
	}

	cutIfTooLong() {
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

export default {
	BetterEmbed,
	templates,
	limits,
};

module.exports = {
	BetterEmbed,
	templates,
	limits,
};
