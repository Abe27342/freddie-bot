export const MAPLESTORY_BASE_API = 'https://maplestory.io';

export interface Item {
	itemId: number;
	version: string;
	region?: string;
}

export interface ItemTypeInfo {
	overallCategory: string;
	category: string;
	subCategory: string;
	lowItemId: number;
	highItemId: number;
}

export interface ItemMetadata {
	id: number;
	region: string; // 'GMS' | 'TMS'
	version: string;
	typeInfo: ItemTypeInfo;
}

export interface ItemSet {
	[subCategory: string]: ItemMetadata; // subcategory should match the subcategory field of ItemTypeInfo inside the metadata.
}

export interface MaplesimImportableJson {
	id: number;
	type: string; // 'character' | 'pet' | 'npc' etc?
	action: string;
	skin: number;
	zoom: number;
	frame: number;
	selectedItems: ItemSet;
	visible: boolean;
	position: { x: number; y: number };
	name: string;
	includeBackground: boolean;
}
