import { Schema, model, Model, Document } from "mongoose";
import { FILE_COLLECTION_NAME } from "../xtreamer.config";

const XtreamerFileSchema = new Schema({
    url: {
        type: Schema.Types.String,
        required: [true, "URL is required"],
        validate: {
            validator: (value: string): boolean => {
                return !!value && typeof value === "string" && !!value.trim();
            },
            message: "URL should be a valid string!"
        },
    },
    file_size: {
        type: Schema.Types.Number,
        default: 0,
        validate: {
            validator: (value: number): boolean => {
                return (!!value || value === 0) && typeof value === "number" && !isNaN(value);
            },
            message: "file_size should be a valid number!"
        },
    },
    is_processed: {
        type: Schema.Types.Boolean,
        default: false
    },
    root_node: {
        type: Schema.Types.String
    },
    structure : {
        type: Schema.Types.Mixed,
        default: null
    }
}, { timestamps: true });

export const FileSchemaInstance = (collectionName: string = FILE_COLLECTION_NAME): Model<Document> => {
    collectionName = collectionName && collectionName.trim() ? collectionName : FILE_COLLECTION_NAME;
    return model("XtreamerFile", XtreamerFileSchema, collectionName);
}