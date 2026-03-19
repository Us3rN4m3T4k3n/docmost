import {
  Group,
  Box,
  Button,
  TextInput,
  Stack,
  Textarea,
  Select,
} from "@mantine/core";
import React from "react";
import { useForm, zodResolver } from "@mantine/form";
import * as z from "zod";
import { useUpdateSpaceMutation } from "@/features/space/queries/space-query.ts";
import { ISpace } from "@/features/space/types/space.types.ts";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(250),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(
      /^[a-zA-Z0-9]+$/,
      "Space slug must be alphanumeric. No special characters",
    ),
  language: z.string().min(2).optional(),
});

type FormValues = z.infer<typeof formSchema>;
interface EditSpaceFormProps {
  space: ISpace;
  readOnly?: boolean;
}
export function EditSpaceForm({ space, readOnly }: EditSpaceFormProps) {
  const { t } = useTranslation();
  const updateSpaceMutation = useUpdateSpaceMutation();

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      name: space?.name,
      description: space?.description || "",
      slug: space.slug,
      language: space?.language || "en-US",
    },
  });

  const handleSubmit = async (values: {
    name?: string;
    description?: string;
    slug?: string;
    language?: string;
  }) => {
    const spaceData: Partial<ISpace> = {
      spaceId: space.id,
    };
    if (form.isDirty("name")) {
      spaceData.name = values.name;
    }
    if (form.isDirty("description")) {
      spaceData.description = values.description;
    }

    if (form.isDirty("slug")) {
      spaceData.slug = values.slug;
    }

    if (form.isDirty("language")) {
      spaceData.language = values.language;
    }

    await updateSpaceMutation.mutateAsync(spaceData);
    form.resetDirty();
  };

  return (
    <>
      <Box>
        <form onSubmit={form.onSubmit((values) => handleSubmit(values))}>
          <Stack>
            <TextInput
              id="name"
              label={t("Name")}
              placeholder={t("e.g Sales")}
              variant="filled"
              readOnly={readOnly}
              {...form.getInputProps("name")}
            />

            <TextInput
              id="slug"
              label={t("Slug")}
              variant="filled"
              readOnly={readOnly}
              {...form.getInputProps("slug")}
            />

            <Textarea
              id="description"
              label={t("Description")}
              placeholder={t("e.g Space for sales team to collaborate")}
              variant="filled"
              readOnly={readOnly}
              autosize
              minRows={1}
              maxRows={3}
              {...form.getInputProps("description")}
            />

            {/* TODO: fetch dynamically from API as new language spaces are added */}
            <Select
              id="language"
              label={t("Language")}
              placeholder={t("Select language")}
              variant="filled"
              disabled={readOnly}
              data={[
                { value: "en-US", label: "English (US)" },
                { value: "pt-BR", label: "Portugues (Brasil)" },
              ]}
              allowDeselect={false}
              {...form.getInputProps("language")}
            />
          </Stack>

          {!readOnly && (
            <Group justify="flex-end" mt="md">
              <Button type="submit" disabled={!form.isDirty()}>
                {t("Save")}
              </Button>
            </Group>
          )}
        </form>
      </Box>
    </>
  );
}
