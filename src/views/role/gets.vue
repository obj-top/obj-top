
<template>
  <el-card>
    <!-- 筛选区域 -->
    <div class="toolbar">
  <el-form :inline="true" class="filter-form">

      <el-form-item label="名称">
        <el-input v-model="obj.name" placeholder="请输入名称" clearable />
      </el-form-item>

      <el-form-item label="菜单">
        <el-select v-model="obj.menus" value-key="id" clearable placeholder="请选择菜单">

        </el-select>
      </el-form-item>

      <el-form-item label="用户">
        <el-input v-model="obj.users" placeholder="请输入用户" clearable />
      </el-form-item>
    <el-form-item>
      <el-button type="primary" @click="obj.getPage()">查询</el-button>
    </el-form-item>
  </el-form>
</div>
    <!-- 表格区域 -->
    <el-table :data="obj.list" style="width: 100%">
  <el-table-column prop="name" label="名称" />
  <el-table-column prop="menus" label="菜单" />
  <el-table-column prop="users" label="用户" />
<el-table-column label="操作" width="240">
    <template #header>
      <el-button size="small" @click="openDialog('add')">新增</el-button>
    </template>
    <template #default="scope">
      <el-button size="small" @click="openDialog('detail', scope.row)">详情</el-button>
      <el-button size="small" @click="openDialog('edit', scope.row)">修改</el-button>
      <el-button size="small" type="danger" @click="obj.del(scope.row.id)">删除</el-button>
    </template>
  </el-table-column>
</el-table>
    <!-- 弹窗：新增/修改/详情 -->
    <el-dialog :title="dialogTitle" v-model="showDialog" width="1000px" @close="obj.reset()">
    <el-form :model="obj">

  <el-form-item label="名称" prop="name">
    <el-input v-model="obj.name" />
  </el-form-item>

  <el-form-item label="菜单" prop="menus">
    <el-table :data="obj.menus" style="width: 100%">

      <el-table-column label="名称" prop="name">
        <template #default="scope">
          <el-input v-model="scope.row.name" placeholder="请输入" />
        </template>
      </el-table-column>

      <el-table-column label="上级id" prop="parent_id">
        <template #default="scope">
          <el-input v-model="scope.row.parent_id" placeholder="请输入" />
        </template>
      </el-table-column>

      <el-table-column label="路径" prop="path">
        <template #default="scope">
          <el-input v-model="scope.row.path" placeholder="请输入" />
        </template>
      </el-table-column>

      <el-table-column label="图标" prop="icon">
        <template #default="scope">
          <el-input v-model="scope.row.icon" placeholder="请输入" />
        </template>
      </el-table-column>

      <el-table-column label="排序" prop="index">
        <template #default="scope">
          <el-input v-model="scope.row.index" placeholder="请输入" />
        </template>
      </el-table-column>

      <el-table-column label="角色" prop="roles">
        <template #default="scope">
          <el-input v-model="scope.row.roles" placeholder="请输入" />
        </template>
      </el-table-column>
      <el-table-column align="right">
      <template #header>
        <el-button size="small" @click="obj.menus.push({})">新增</el-button>
      </template>
      <template #default="scope">
        <el-button
            size="small"
            type="danger"
            @click="obj.menus.splice(scope.$index, 1)"
        >
          Delete
        </el-button>
      </template>
    </el-table-column>
    </el-table>
  </el-form-item>
</el-form>
      <template #footer>
        <el-button @click="showDialog = false">关闭</el-button>
        <el-button type="primary" v-if="dialogMode !== 'detail'" @click="obj.sync().then(() => showDialog = false)">提交</el-button>
      </template>
    </el-dialog>
  </el-card>
  <el-pagination v-model:current-page="obj.page" v-model:page-size="obj.size" :total="obj.total" @current-change="obj.getPage()" background layout="total,prev, pager, next"  />
</template>

<script lang="ts" setup>
import { ref,onMounted } from 'vue';

import {Role} from "../../arpc/Role.ts";
import {Permission} from "../../arpc/Permission.ts";
let obj=new Role()
obj.getPage()
onMounted(async () => {
   let rsp=await Role.sel('id','name',Permission.sel('id','name')).get`id>=${1}`
  console.log(rsp)
})
const showDialog = ref(false);
const dialogMode = ref<'add' | 'edit' | 'detail'>('add')
const dialogTitle = ref('')
//@ts-ignore
function openDialog(mode, row) {
  dialogMode.value = mode;
  dialogTitle.value = mode === 'add' ? '新增' : mode === 'edit' ? '修改' : '查看详情';
  if (row) {
    Object.assign(obj, row)
  } else {
    Object.assign(obj, {})
  }
  showDialog.value = true;
}
</script>

<style scoped>
.toolbar {
  margin-bottom: 20px;
}
.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
