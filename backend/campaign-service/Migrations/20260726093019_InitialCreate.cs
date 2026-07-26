using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend_cs.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "group",
                columns: table => new
                {
                    group_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    name = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    photo_link = table.Column<string>(type: "longtext", nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_group", x => x.group_id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "user_group",
                columns: table => new
                {
                    user_id = table.Column<int>(type: "int", nullable: false),
                    group_id = table.Column<int>(type: "int", nullable: false),
                    is_admin = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_group", x => new { x.user_id, x.group_id });
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "charlist_template",
                columns: table => new
                {
                    template_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    group_id = table.Column<int>(type: "int", nullable: false),
                    uuid = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_charlist_template", x => x.template_id);
                    table.ForeignKey(
                        name: "FK_charlist_template_group_group_id",
                        column: x => x.group_id,
                        principalTable: "group",
                        principalColumn: "group_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "item",
                columns: table => new
                {
                    item_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    group_id = table.Column<int>(type: "int", nullable: false),
                    uuid = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_item", x => x.item_id);
                    table.ForeignKey(
                        name: "FK_item_group_group_id",
                        column: x => x.group_id,
                        principalTable: "group",
                        principalColumn: "group_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "quest",
                columns: table => new
                {
                    quest_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    header = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    status = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    group_id = table.Column<int>(type: "int", nullable: false),
                    uuid = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_quest", x => x.quest_id);
                    table.ForeignKey(
                        name: "FK_quest_group_group_id",
                        column: x => x.group_id,
                        principalTable: "group",
                        principalColumn: "group_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "skill",
                columns: table => new
                {
                    skill_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    group_id = table.Column<int>(type: "int", nullable: false),
                    uuid = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_skill", x => x.skill_id);
                    table.ForeignKey(
                        name: "FK_skill_group_group_id",
                        column: x => x.group_id,
                        principalTable: "group",
                        principalColumn: "group_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "user_character",
                columns: table => new
                {
                    user_id = table.Column<int>(type: "int", nullable: false),
                    group_id = table.Column<int>(type: "int", nullable: false),
                    character_id = table.Column<int>(type: "int", nullable: false),
                    can_write = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_character", x => new { x.user_id, x.group_id, x.character_id });
                    table.ForeignKey(
                        name: "FK_user_character_user_group_user_id_group_id",
                        columns: x => new { x.user_id, x.group_id },
                        principalTable: "user_group",
                        principalColumns: new[] { "user_id", "group_id" },
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "character",
                columns: table => new
                {
                    character_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    template_id = table.Column<int>(type: "int", nullable: false),
                    owner_id = table.Column<int>(type: "int", nullable: true),
                    group_id = table.Column<int>(type: "int", nullable: false),
                    uuid = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_character", x => x.character_id);
                    table.ForeignKey(
                        name: "FK_character_charlist_template_template_id",
                        column: x => x.template_id,
                        principalTable: "charlist_template",
                        principalColumn: "template_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_character_group_group_id",
                        column: x => x.group_id,
                        principalTable: "group",
                        principalColumn: "group_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "character_item",
                columns: table => new
                {
                    character_id = table.Column<int>(type: "int", nullable: false),
                    item_id = table.Column<int>(type: "int", nullable: false),
                    amount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_character_item", x => new { x.item_id, x.character_id });
                    table.ForeignKey(
                        name: "FK_character_item_character_character_id",
                        column: x => x.character_id,
                        principalTable: "character",
                        principalColumn: "character_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_character_item_item_item_id",
                        column: x => x.item_id,
                        principalTable: "item",
                        principalColumn: "item_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "character_skill",
                columns: table => new
                {
                    character_id = table.Column<int>(type: "int", nullable: false),
                    skill_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_character_skill", x => new { x.skill_id, x.character_id });
                    table.ForeignKey(
                        name: "FK_character_skill_character_character_id",
                        column: x => x.character_id,
                        principalTable: "character",
                        principalColumn: "character_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_character_skill_skill_skill_id",
                        column: x => x.skill_id,
                        principalTable: "skill",
                        principalColumn: "skill_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "note",
                columns: table => new
                {
                    note_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    character_id = table.Column<int>(type: "int", nullable: true),
                    header = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    short_description = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    addition_date = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    modified_date = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    group_id = table.Column<int>(type: "int", nullable: false),
                    uuid = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_note", x => x.note_id);
                    table.ForeignKey(
                        name: "FK_note_character_character_id",
                        column: x => x.character_id,
                        principalTable: "character",
                        principalColumn: "character_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_note_group_group_id",
                        column: x => x.group_id,
                        principalTable: "group",
                        principalColumn: "group_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "quest_assignment",
                columns: table => new
                {
                    quest_id = table.Column<int>(type: "int", nullable: false),
                    character_id = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_quest_assignment", x => new { x.quest_id, x.character_id });
                    table.ForeignKey(
                        name: "FK_quest_assignment_character_character_id",
                        column: x => x.character_id,
                        principalTable: "character",
                        principalColumn: "character_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_quest_assignment_quest_quest_id",
                        column: x => x.quest_id,
                        principalTable: "quest",
                        principalColumn: "quest_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "note_keyword",
                columns: table => new
                {
                    note_id = table.Column<int>(type: "int", nullable: false),
                    keyword = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_note_keyword", x => new { x.note_id, x.keyword });
                    table.ForeignKey(
                        name: "FK_note_keyword_note_note_id",
                        column: x => x.note_id,
                        principalTable: "note",
                        principalColumn: "note_id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_character_group_id",
                table: "character",
                column: "group_id");

            migrationBuilder.CreateIndex(
                name: "IX_character_template_id",
                table: "character",
                column: "template_id");

            migrationBuilder.CreateIndex(
                name: "IX_character_item_character_id",
                table: "character_item",
                column: "character_id");

            migrationBuilder.CreateIndex(
                name: "IX_character_skill_character_id",
                table: "character_skill",
                column: "character_id");

            migrationBuilder.CreateIndex(
                name: "IX_charlist_template_group_id",
                table: "charlist_template",
                column: "group_id");

            migrationBuilder.CreateIndex(
                name: "IX_item_group_id",
                table: "item",
                column: "group_id");

            migrationBuilder.CreateIndex(
                name: "IX_note_character_id",
                table: "note",
                column: "character_id");

            migrationBuilder.CreateIndex(
                name: "IX_note_group_id",
                table: "note",
                column: "group_id");

            migrationBuilder.CreateIndex(
                name: "IX_quest_group_id",
                table: "quest",
                column: "group_id");

            migrationBuilder.CreateIndex(
                name: "IX_quest_assignment_character_id",
                table: "quest_assignment",
                column: "character_id");

            migrationBuilder.CreateIndex(
                name: "IX_skill_group_id",
                table: "skill",
                column: "group_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "character_item");

            migrationBuilder.DropTable(
                name: "character_skill");

            migrationBuilder.DropTable(
                name: "note_keyword");

            migrationBuilder.DropTable(
                name: "quest_assignment");

            migrationBuilder.DropTable(
                name: "user_character");

            migrationBuilder.DropTable(
                name: "item");

            migrationBuilder.DropTable(
                name: "skill");

            migrationBuilder.DropTable(
                name: "note");

            migrationBuilder.DropTable(
                name: "quest");

            migrationBuilder.DropTable(
                name: "user_group");

            migrationBuilder.DropTable(
                name: "character");

            migrationBuilder.DropTable(
                name: "charlist_template");

            migrationBuilder.DropTable(
                name: "group");
        }
    }
}
