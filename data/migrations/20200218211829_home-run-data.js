
exports.up = function (knex) {
	return knex.schema
		.createTable('households', col => {
			col.varchar('id', 7).notNullable().unique()
			col.string('title', 40)
			col.integer('pin', 4)
		})
		.createTable('members', col => {
			col.increments()
			col.string('username', 40).notNullable()
			col.string('email', 128).notNullable()
			col.string('password').notNullable()
			col.string('token')
			col.boolean('child')
			col.integer('points')
			col.varchar('current_household')
				.unsigned()
				.references('households.id')
				.onDelete('CASCADE')
				.onUpdate('CASCADE')
		})
		.createTable('todos', col => {
			col.increments()
			col.string('household').notNullable()
			col.string('title', 40).notNullable()
			col.string('desc', 255)
			col.integer('point_value')
			col.bigint('due')
			col.boolean('completed')
			col.string('completed_by')
		})
		.createTable('rewards', col => {
			col.increments()
			col.string('title').notNullable()
			col.integer('point_total').notNullable()
			col.varchar('household_id')
				.unsigned()
				.references('households.id')
				.onDelete('CASCADE')
				.onUpdate('CASCADE')
		})
		.createTable('inventory', col => {
			col.increments()
			col.varchar('household_id')
				.unsigned()
				.references('households.id')
				.onDelete('CASCADE')
				.onUpdate('CASCADE')
		})
		.createTable('bills', col => {
			col.increments()
			col.varchar('household_id')
				.unsigned()
				.references('households.id')
				.onDelete('CASCADE')
				.onUpdate('CASCADE')
		})
		.createTable('household_members', col => {
			col.increments()
			col.integer('member_id')
				.unsigned()
				.references('members.id')
				.onDelete('CASCADE')
				.onUpdate('CASCADE')
			col.varchar('household_id')
				.unsigned()
				.references('households.id')
				.onDelete('CASCADE')
				.onUpdate('CASCADE')
		})
		.createTable('household_todos', col => {
			col.increments()
			col.integer('todos_id')
				.unsigned()
				.references('todos.id')
				.onDelete('CASCADE')
				.onUpdate('CASCADE')
			col.varchar('household_id')
				.unsigned()
				.references('households.id')
				.onDelete('CASCADE')
				.onUpdate('CASCADE')
		})
		.createTable('todos_members', col => {
			col.increments()
			col.integer('members_id')
				.unsigned()
				.references('members.id')
				.onDelete('CASCADE')
				.onUpdate('CASCADE')
			col.integer('todos_id')
				.unsigned()
				.references('todos.id')
				.onDelete('CASCADE')
				.onUpdate('CASCADE')
		})
};

exports.down = function (knex) {
	return knex.schema
		.dropTableIfExists('todos_members')
		.dropTableIfExists('household_todos')
		.dropTableIfExists('household_members')
		.dropTableIfExists('bills')
		.dropTableIfExists('inventory')
		.dropTableIfExists('rewards')
		.dropTableIfExists('todos')
		.dropTableIfExists('members')
		.dropTableIfExists('households')
};