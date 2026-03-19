import {
  Group,
  Box,
  Button,
  TextInput,
  Stack,
  Textarea,
  Select,
} from "@mantine/core";
import React, { useEffect } from "react";
import { useForm, zodResolver } from "@mantine/form";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { useCreateSpaceMutation } from "@/features/space/queries/space-query.ts";
import { computeSpaceSlug } from "@/lib";
import { getSpaceUrl } from "@/lib/config.ts";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
  name: z.string().trim().min(2).max(50),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(
      /^[a-zA-Z0-9]+$/,
      "Space slug must be alphanumeric. No special characters",
    ),
  description: z.string().max(500),
  language: z.string().min(2, "Language is required"),
});
type FormValues = z.infer<typeof formSchema>;

export function CreateSpaceForm() {
  const { t } = useTranslation();
  const createSpaceMutation = useCreateSpaceMutation();
  const navigate = useNavigate();

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    validateInputOnChange: ["slug"],
    initialValues: {
      name: "",
      slug: "",
      description: "",
      language: "",
    },
  });

  useEffect(() => {
    const name = form.values.name;
    const words = name.trim().split(/\s+/);

    // Check if the last character is a space or if the last word is a single character (indicating it's in progress)
    const lastChar = name[name.length - 1];
    const lastWordIsIncomplete =
      words.length > 1 && words[words.length - 1].length === 1;

    if (lastChar !== " " || lastWordIsIncomplete) {
      const slug = computeSpaceSlug(name);
      form.setFieldValue("slug", slug);
    }
  }, [form.values.name]);

  const handleSubmit = async (data: {
    name?: string;
    slug?: string;
    description?: string;
    language?: string;
  }) => {
    const spaceData = {
      name: data.name,
      slug: data.slug,
      description: data.description,
      language: data.language,
    };

    const createdSpace = await createSpaceMutation.mutateAsync(spaceData);
    navigate(getSpaceUrl(createdSpace.slug));
  };

  return (
    <>
      <Box maw="500" mx="auto">
        <form onSubmit={form.onSubmit((values) => handleSubmit(values))}>
          <Stack>
            <TextInput
              withAsterisk
              id="name"
              label={t("Space name")}
              placeholder={t("e.g Product Team")}
              variant="filled"
              {...form.getInputProps("name")}
            />

            <TextInput
              withAsterisk
              id="slug"
              label={t("Space slug")}
              placeholder={t("e.g product")}
              variant="filled"
              {...form.getInputProps("slug")}
            />

            <Textarea
              id="description"
              label={t("Space description")}
              placeholder={t("e.g Space for product team")}
              variant="filled"
              autosize
              minRows={2}
              maxRows={8}
              {...form.getInputProps("description")}
            />

            {/* TODO: fetch dynamically from API as new language spaces are added */}
            <Select
              withAsterisk
              id="language"
              label={t("Language")}
              placeholder={t("Select language")}
              variant="filled"
              data={[
                { value: "en-US", label: "English (US)" },
                { value: "pt-BR", label: "Portugues (Brasil)" },
              ]}
              allowDeselect={false}
              {...form.getInputProps("language")}
            />
          </Stack>

          <Group justify="flex-end" mt="md">
            <Button type="submit">{t("Create")}</Button>
          </Group>
        </form>
      </Box>
    </>
  );
}
